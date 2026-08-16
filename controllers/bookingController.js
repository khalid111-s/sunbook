const Booking = require('../models/Booking');
const Session = require('../models/Session');
const User = require('../models/User');
const { createPaytabsPaymentIntent, isPaytabsConfigured } = require('../utils/paytabs');
const { sendBookingConfirmationEmail, sendNewBookingAdminAlert, sendBookingReminderEmail } = require('../utils/email');

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
  if (!booking.confirmationEmailSent) {
    booking.confirmationEmailSent = true;
    await booking.save();

    const student = studentUser || (await User.findById(booking.student));
    const bookingEmailData = {
      studentName: student?.name,
      studentEmail: student?.email,
      studentPhone: student?.phone,
      subject: booking.subject,
      date: booking.date,
      price: booking.price,
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
  await createSessionForBooking(booking);
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

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason;
  await booking.save();

  await Session.updateOne({ booking: booking._id }, { status: 'cancelled' });

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

  res.json({ success: true, remindersSent: sentCount });
};

module.exports = {
  createBooking,
  getAllBookings,
  getMyBookings,
  cancelBooking,
  sendUpcomingReminders,
  paytabsCallback,
  paytabsReturnRedirect,
};
