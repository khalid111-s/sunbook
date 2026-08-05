const Booking = require('../models/Booking');
const Session = require('../models/Session');
const User = require('../models/User');
const { createPaymobPaymentIntent } = require('../utils/paymob');

const paymobConfigured = () => {
  const key = process.env.PAYMOB_API_KEY || '';
  const integrationId = process.env.PAYMOB_INTEGRATION_ID || '';
  const iframeId = process.env.PAYMOB_IFRAME_ID || '';
  return (
    key.length > 0 && !key.includes('your_paymob') &&
    integrationId.length > 0 && !integrationId.includes('your_paymob') &&
    iframeId.length > 0 && !iframeId.includes('your_paymob')
  );
};

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

  if (paymobConfigured()) {
    try {
      const paymentData = await createPaymobPaymentIntent(booking);
      booking.paymobOrderId = paymentData.orderId;
      booking.paymobPaymentKey = paymentData.paymentKey;
      await booking.save();

      if (process.env.PAYMOB_IFRAME_ID) {
        paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentData.paymentKey}`;
      }
    } catch (err) {
      console.error('Paymob Error:', err.message);
    }
  } else {
    // وضع التطوير: تأكيد الحجز وإنشاء الجلسة بدون دفع
    booking.status = 'paid';
    await booking.save();
    await createSessionForBooking(booking);
  }

  res.status(201).json({
    success: true,
    data: { booking, paymentUrl },
  });
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

const paymobCallback = async (req, res) => {
  try {
    const { obj } = req.body;

    if (!obj) {
      return res.status(400).json({ message: 'Invalid callback data' });
    }

    const orderId = obj.order?.id || obj.order_id;
    const success = obj.success === true || obj.payment_status === 'PAID';

    if (!success) {
      return res.json({ success: false, message: 'Payment not successful' });
    }

    const booking = await Booking.findOne({ paymobOrderId: String(orderId) });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.status = 'paid';
    await booking.save();
    await createSessionForBooking(booking);

    res.json({ success: true, message: 'Payment processed and session created' });
  } catch (error) {
    console.error('Paymob callback error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
  paymobCallback,
};
