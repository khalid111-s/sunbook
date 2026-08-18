const Booking = require('../models/Booking');
const Session = require('../models/Session');
const User = require('../models/User');
const { createPaytabsPaymentIntent, isPaytabsConfigured, refundPaytabsTransaction } = require('../utils/paytabs');
const { sendBookingConfirmationEmail, sendNewBookingAdminAlert, sendBookingReminderEmail, sendBookingCancelledEmail, sendSessionMissedEmail, sendBookingRescheduledEmail } = require('../utils/email');

async function createSessionForBooking(booking) {
  const existing = await Session.findOne({ booking: booking._id });
  if (existing) return existing;

  const roomName = `sunbook-${booking._id.toString().slice(-6)}-${Date.now().toString(36)}`;
  const jitsiDomain = process.env.JITSI_DOMAIN || 'meet.jit.si';

  return Session.create({
    booking: booking._id,
    student: booking.student,
    teacher: booking.teacher,
    subject: booking.subject,
    scheduledDate: booking.date,
    duration: booking.duration,
    jitsiRoomName: roomName,
    jitsiRoomUrl: `https://${jitsiDomain}/${roomName}`,
    status: 'scheduled',
  });
}

// بيحدّث حالة الحجز لـ "paid" ويبعت إيميلات التأكيد/التنبيه مرة واحدة بس، بعد ما الدفع يتأكد فعليًا
const markBookingPaidAndNotify = async (booking, studentUser) => {
  booking.status = 'paid';
  const session = await createSessionForBooking(booking);

  if (!booking.confirmationEmailSent) {
    booking.confirmationEmailSent = true;
    await booking.save();

    const student = studentUser || (await User.findById(booking.student));
    const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
    const bookingEmailData = {
      studentName: student?.name,
      studentEmail: student?.email,
      studentPhone: student?.phone,
      subject: booking.subject,
      date: booking.date,
      price: booking.price,
      sessionJoinUrl: `${frontendBase}/session.html?id=${session._id}`,
    };
    try {
      await sendBookingConfirmationEmail(bookingEmailData);
    } catch (err) {
      console.error('Booking confirmation email failed:', err.message);
    }
    try {
      await sendNewBookingAdminAlert(bookingEmailData);
    } catch (err) {
      console.error('Admin booking alert email failed:', err.message);
    }
  } else {
    await booking.save();
  }
};

// المواعيد الثابتة المتاحة كل يوم (وقت القاهرة)
const DAILY_SLOTS = ['4:00 PM', '6:00 PM', '8:00 PM'];

// @desc    Returns which dates in a given month are fully booked (all 3 slots taken),
//          so the calendar can grey them out without checking each day one by one.
// @route   GET /api/bookings/availability-month?year=YYYY&month=MM
// @access  Public
const getMonthAvailability = async (req, res) => {
  const { year, month } = req.query; // month: 1-12
  if (!year || !month) {
    res.status(400);
    throw new Error('year and month query params are required');
  }

  const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const bookings = await Booking.find({
    date: { $gte: monthStart, $lt: monthEnd },
    status: { $ne: 'cancelled' },
  }).select('date');

  const countByDay = {};
  for (const b of bookings) {
    const dayKey = new Date(b.date).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); // YYYY-MM-DD
    countByDay[dayKey] = (countByDay[dayKey] || 0) + 1;
  }

  const fullyBookedDates = Object.keys(countByDay).filter((day) => countByDay[day] >= DAILY_SLOTS.length);

  res.json({ success: true, data: { fullyBookedDates } });
};

// @desc    Returns which of the day's 3 fixed slots are already booked for a given date,
//          based on REAL bookings in the database (not client-side guesses).
// @route   GET /api/bookings/availability?date=YYYY-MM-DD
// @access  Public
const getAvailability = async (req, res) => {
  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('date query param is required (YYYY-MM-DD)');
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const bookings = await Booking.find({
    date: { $gte: dayStart, $lte: dayEnd },
    status: { $ne: 'cancelled' },
  }).select('date');

  const bookedTimes = bookings.map((b) =>
    new Date(b.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Cairo' })
  );

  const slots = DAILY_SLOTS.map((time) => ({ time, booked: bookedTimes.includes(time) }));
  const isFullyBooked = slots.every((s) => s.booked);

  res.json({ success: true, data: { slots, isFullyBooked } });
};

const createBooking = async (req, res) => {
  const { teacherId, subject, date, duration, price, paymentMethod, notes } = req.body;

  const teacher = await User.findById(teacherId);
  if (!teacher) {
    res.status(404);
    throw new Error('Teacher not found');
  }

  const bookingDate = new Date(date);
  if (Number.isNaN(bookingDate.getTime())) {
    res.status(400);
    throw new Error('Invalid booking date');
  }

  // لازم يحجز ليوم بعده على الأقل - مفيش حجز لنفس اليوم
  const tomorrowStart = new Date();
  tomorrowStart.setHours(0, 0, 0, 0);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  if (bookingDate < tomorrowStart) {
    res.status(400);
    throw new Error('Sessions must be booked at least one day in advance');
  }

  const existingBooking = await Booking.findOne({
    teacher: teacherId,
    date: bookingDate,
    status: { $nin: ['cancelled'] },
  });

  if (existingBooking) {
    res.status(400);
    throw new Error('This time slot is already booked');
  }

  const booking = await Booking.create({
    student: req.user._id,
    teacher: teacherId,
    subject: subject || 'Exclusive One-on-One Session',
    date: bookingDate,
    duration: duration || 30,
    price: price || 199,
    paymentMethod: paymentMethod || 'card',
    notes,
    status: 'pending',
  });

  let paymentUrl = null;

  if (isPaytabsConfigured()) {
    try {
      const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
      const backendBase = process.env.BACKEND_URL || `https://${req.get('host')}`;

      const paymentData = await createPaytabsPaymentIntent({
        amount: booking.price,
        currency: 'EGP',
        cartId: booking._id.toString(),
        description: `Session booking: ${booking.subject}`.slice(0, 250),
        customer: {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
          country: 'EG',
          ip: req.ip,
        },
        callbackUrl: `${backendBase}/api/bookings/paytabs-callback`,
        returnUrl: `${backendBase}/api/bookings/paytabs-return?booking=${booking._id}`,
      });

      booking.paytabsTranRef = paymentData.tranRef;
      await booking.save();
      paymentUrl = paymentData.redirectUrl;
    } catch (err) {
      console.error('PayTabs Error (booking):', err.response?.data || err.message);
    }
  }

  if (!paymentUrl && !isPaytabsConfigured()) {
    // وضع التطوير: تأكيد الحجز وإنشاء الجلسة بدون دفع
    await markBookingPaidAndNotify(booking, req.user);
  }

  res.status(201).json({
    success: true,
    data: { booking, paymentUrl },
  });
};

// @desc    List all bookings (date/time, payment status, student info) for the admin Sessions tab
// @route   GET /api/bookings
// @access  Private/Admin
const getAllBookings = async (req, res) => {
  const bookings = await Booking.find()
    .populate('student', 'name email phone')
    .populate('teacher', 'name email')
    .sort({ date: -1 });

  res.json({ success: true, count: bookings.length, data: bookings });
};

const getMyBookings = async (req, res) => {
  const bookings = await Booking.find({
    $or: [{ student: req.user._id }, { teacher: req.user._id }],
  })
    .populate('teacher', 'name email')
    .populate('student', 'name email')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: bookings.length, data: bookings });
};

// @desc    Reschedule a booking to a new date/time instead of cancelling it entirely -
//          allowed once per booking, same 4-hour cutoff as cancellation applies.
// @route   PATCH /api/bookings/:id/reschedule
// @access  Private (booking owner only)
const rescheduleBooking = async (req, res) => {
  const { date } = req.body;
  if (!date) {
    res.status(400);
    throw new Error('Please choose a new date and time');
  }

  const booking = await Booking.findOne({ _id: req.params.id, student: req.user._id });
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  if (!['pending', 'paid'].includes(booking.status)) {
    res.status(400);
    throw new Error('This booking can no longer be rescheduled');
  }

  if (booking.rescheduleCount >= 1) {
    res.status(400);
    throw new Error('This session has already been rescheduled once. Please contact support for further changes.');
  }

  const hoursUntilSession = (new Date(booking.date).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilSession < 4) {
    res.status(400);
    throw new Error('Sessions can only be rescheduled at least 4 hours before the scheduled time');
  }

  const newDate = new Date(date);
  if (Number.isNaN(newDate.getTime())) {
    res.status(400);
    throw new Error('Invalid date or time');
  }

  const tomorrowStart = new Date();
  tomorrowStart.setHours(0, 0, 0, 0);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  if (newDate < tomorrowStart) {
    res.status(400);
    throw new Error('Sessions must be booked at least one day in advance');
  }

  const newTimeLabel = newDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Cairo' });
  if (!DAILY_SLOTS.includes(newTimeLabel)) {
    res.status(400);
    throw new Error('Please choose one of the available time slots');
  }

  // نتأكد إن الميعاد الجديد ده لسه فاضي (مفيش حجز تاني واخده)
  const conflictingBooking = await Booking.findOne({
    _id: { $ne: booking._id },
    date: newDate,
    status: { $ne: 'cancelled' },
  });
  if (conflictingBooking) {
    res.status(400);
    throw new Error('This time slot is already booked. Please choose another one.');
  }

  const oldDate = booking.date;
  booking.date = newDate;
  booking.rescheduleCount += 1;
  booking.reminderSent = false; // عشان التذكير يتبعت تاني على الميعاد الجديد
  await booking.save();

  // نحدّث الجلسة المرتبطة لو كانت اتعملت أصلاً (يعني الحجز كان متأكد)
  await Session.updateOne({ booking: booking._id }, { scheduledDate: newDate });

  const student = await User.findById(booking.student);
  try {
    await sendBookingRescheduledEmail({
      studentName: student?.name,
      studentEmail: student?.email,
      subject: booking.subject,
      date: booking.date,
      oldDate,
    });
  } catch (err) {
    console.error('Reschedule email failed:', err.message);
  }

  res.json({ success: true, data: booking });
};

const cancelBooking = async (req, res) => {
  const { reason } = req.body;

  const booking = await Booking.findOne({
    _id: req.params.id,
    $or: [{ student: req.user._id }, { teacher: req.user._id }],
  });

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  if (booking.status === 'cancelled') {
    res.status(400);
    throw new Error('Booking is already cancelled');
  }

  if (booking.status === 'completed') {
    res.status(400);
    throw new Error('Cannot cancel a completed booking');
  }

  // لازم يكون فاضل على الجلسة 4 ساعات على الأقل عشان تقدر تلغيها
  const hoursUntilSession = (new Date(booking.date).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilSession < 4) {
    res.status(400);
    throw new Error('Sessions can only be cancelled at least 4 hours before the scheduled time');
  }

  // لو كان مدفوع فعليًا، نرجّع الفلوس قبل ما نلغي رسميًا
  let wasRefunded = false;
  if (booking.status === 'paid' && booking.paytabsTranRef) {
    try {
      const refundResult = await refundPaytabsTransaction({
        tranRef: booking.paytabsTranRef,
        amount: booking.price,
        currency: 'EGP',
        cartId: booking._id.toString(),
        reason: 'Booking cancelled by user',
      });
      wasRefunded = refundResult.success;
      if (!refundResult.success) {
        console.error('Refund did not succeed for booking', booking._id, refundResult.raw);
      }
    } catch (err) {
      console.error('Refund request failed for booking', booking._id, err.response?.data || err.message);
      res.status(500);
      throw new Error('Could not process the refund right now. Please contact support.');
    }
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason;
  await booking.save();

  await Session.updateOne({ booking: booking._id }, { status: 'cancelled' });

  const student = await User.findById(booking.student);
  try {
    await sendBookingCancelledEmail({
      studentName: student?.name,
      studentEmail: student?.email,
      subject: booking.subject,
      date: booking.date,
      refunded: wasRefunded,
    });
  } catch (err) {
    console.error('Booking cancellation email failed:', err.message);
  }

  res.json({ success: true, data: booking });
};

// @desc    PayTabs webhook - marks a booking as paid once payment is confirmed
// @route   POST /api/bookings/paytabs-callback
// @access  Public (called by PayTabs' servers, server-to-server)
const paytabsCallback = async (req, res) => {
  try {
    const body = req.body || {};
    const cartId = body.cart_id;
    const tranRef = body.tran_ref;
    const responseStatus = body.payment_result?.response_status; // 'A' = Approved

    if (!cartId && !tranRef) {
      return res.status(400).json({ message: 'Invalid callback data' });
    }

    const booking = cartId
      ? await Booking.findById(cartId).catch(() => null)
      : await Booking.findOne({ paytabsTranRef: tranRef });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (tranRef) booking.paytabsTranRef = tranRef;

    if (responseStatus === 'A') {
      await markBookingPaidAndNotify(booking);
    } else {
      booking.status = 'cancelled';
      await booking.save();
    }

    res.json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    console.error('PayTabs callback error (booking):', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bridge endpoint for PayTabs' return redirect - bounces the browser back
//          to the profile page's sessions tab with a GET request.
// @route   ALL /api/bookings/paytabs-return
// @access  Public
const paytabsReturnRedirect = (req, res) => {
  const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
  res.redirect(302, `${frontendBase}/profile.html?tab=sessions&paytabs_return=1`);
};

// @desc    Sends a reminder email to any student whose paid session starts in the next ~10 minutes
//          and hasn't been reminded yet. Meant to be called periodically by an external cron
//          (e.g. cron-job.org) hitting this endpoint every 5 minutes with the secret key.
// @route   GET /api/bookings/send-reminders?key=CRON_SECRET
// @access  Public (protected by a shared secret, not user auth, since it's called by a cron service)
const sendUpcomingReminders = async (req, res) => {
  const providedKey = req.query.key || req.headers['x-cron-key'];
  if (!process.env.CRON_SECRET || providedKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 5 * 60000); // من 5 دقايق من دلوقتي
  const windowEnd = new Date(now.getTime() + 15 * 60000); // لحد 15 دقيقة من دلوقتي (يغطي أي فجوة بين تشغيلتين للـ cron)

  const bookings = await Booking.find({
    status: 'paid',
    reminderSent: false,
    date: { $gte: windowStart, $lte: windowEnd },
  }).populate('student', 'name email');

  const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
  let sentCount = 0;

  for (const booking of bookings) {
    const session = await Session.findOne({ booking: booking._id });
    try {
      await sendBookingReminderEmail({
        studentName: booking.student?.name,
        studentEmail: booking.student?.email,
        subject: booking.subject,
        date: booking.date,
        sessionUrl: session ? `${frontendBase}/session.html?id=${session._id}` : `${frontendBase}/profile.html`,
      });
      sentCount += 1;
    } catch (err) {
      console.error('Reminder email failed for booking', booking._id, err.message);
    }
    booking.reminderSent = true;
    await booking.save();
  }

  // --- نفس الـ cron كمان بيكشف الجلسات اللي فاتت ومحدش دخلها، ويقفلها ---
  const missedThreshold = new Date(now.getTime() - 15 * 60000); // فات عليها 15 دقيقة من نهاية الميعاد
  const candidateSessions = await Session.find({ status: 'scheduled' }).populate('booking');

  let missedCount = 0;
  for (const session of candidateSessions) {
    const scheduledEnd = new Date(session.scheduledDate.getTime() + (session.duration || 30) * 60000);
    if (scheduledEnd > missedThreshold) continue; // لسه في وقتها أو في فترة السماح

    session.status = 'missed';
    await session.save();

    if (session.booking) {
      await Booking.updateOne({ _id: session.booking._id }, { status: 'cancelled', cancellationReason: 'Student/teacher did not join in time' });
    }

    const student = await User.findById(session.student);
    try {
      await sendSessionMissedEmail({
        studentName: student?.name,
        studentEmail: student?.email,
        subject: session.booking?.subject || session.subject,
        date: session.scheduledDate,
      });
    } catch (err) {
      console.error('Missed-session email failed for session', session._id, err.message);
    }
    missedCount += 1;
  }

  res.json({ success: true, remindersSent: sentCount, sessionsMarkedMissed: missedCount });
};

module.exports = {
  createBooking,
  getAllBookings,
  getMyBookings,
  getAvailability,
  getMonthAvailability,
  cancelBooking,
  rescheduleBooking,
  sendUpcomingReminders,
  paytabsCallback,
  paytabsReturnRedirect,
};
