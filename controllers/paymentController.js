const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const geidea = require('../utils/geidea');
const { markOrderPaidAndNotify } = require('./orderController');
const { markBookingPaidAndNotify } = require('./bookingController');

const BOOKING_CURRENCY = 'EGP';

// بيعلّم الدفعة والطلب والحجوزات "مدفوعة" مرة واحدة بس (حتى لو الـ callback والـ confirm وصلوا في نفس اللحظة)
const finalizePaid = async (paymentId, geideaOrderId) => {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'pending' },
    { status: 'paid', geideaOrderId: geideaOrderId || '' },
    { new: true }
  );
  if (!payment) return false; // حد تاني خلّصها قبلنا

  if (payment.order) {
    const order = await Order.findById(payment.order);
    if (order && order.status === 'pending') await markOrderPaidAndNotify(order);
  }
  for (const bookingId of payment.bookings) {
    const booking = await Booking.findById(bookingId);
    if (!booking) continue;
    if (booking.status !== 'pending') {
      console.warn(`Payment ${payment._id} succeeded but booking ${booking._id} is already ${booking.status}`);
      continue;
    }
    await markBookingPaidAndNotify(booking);
  }
  return true;
};

// بنسأل Geidea مباشرة (من السيرفر) إن كان فيه دفع ناجح بنفس المرجع والمبلغ والعملة.
// مبنثقش في أي حاجة جاية من المتصفح أو من جسم الـ callback لوحده.
const verifyWithGeidea = async (payment) => {
  if (payment.status === 'paid') return 'paid';
  const orders = await geidea.fetchOrdersByReference(payment.merchantReferenceId);
  const paid = orders.find(
    (o) => geidea.isOrderPaid(o) && geidea.sameAmount(o.amount, payment.amount) && o.currency === payment.currency
  );
  if (!paid) return 'pending';
  await finalizePaid(payment._id, paid.orderId);
  return 'paid';
};

// @desc    Create a Geidea payment session for a pending order and/or pending bookings
// @route   POST /api/payments/session
// @access  Private
const createPaymentSession = async (req, res) => {
  const { orderId, bookingIds, language } = req.body;
  const ids = Array.isArray(bookingIds) ? bookingIds.filter(Boolean) : [];

  if (!orderId && ids.length === 0) {
    res.status(400);
    throw new Error('Nothing to pay for');
  }

  let amount = 0;
  let currency = null;

  let order = null;
  if (orderId) {
    order = await Order.findById(orderId);
    if (!order || String(order.user) !== String(req.user._id)) {
      res.status(404);
      throw new Error('Order not found');
    }
    if (order.status !== 'pending' || order.paymentMethod === 'cod') {
      res.status(400);
      throw new Error('This order cannot be paid online');
    }
    amount += order.totalAmount;
    currency = order.currency;
  }

  const bookings = ids.length
    ? await Booking.find({ _id: { $in: ids }, student: req.user._id, status: 'pending' })
    : [];
  if (bookings.length !== ids.length) {
    res.status(400);
    throw new Error('One or more bookings are no longer available. Please book again.');
  }
  if (bookings.length > 0) {
    if (currency && currency !== BOOKING_CURRENCY) {
      res.status(400);
      throw new Error('Sessions and euro-priced orders cannot be paid in the same payment');
    }
    currency = BOOKING_CURRENCY;
    amount += bookings.reduce((sum, b) => sum + b.price, 0);
  }
  amount = Math.round(amount * 100) / 100;

  const payment = new Payment({
    user: req.user._id,
    order: order ? order._id : undefined,
    bookings: bookings.map((b) => b._id),
    amount,
    currency,
  });
  payment.merchantReferenceId = String(payment._id);

  // طلب مجاني بالكامل (كود خصم 100%): مفيش حاجة تتدفع، بنأكده على طول
  if (amount <= 0) {
    await payment.save();
    await finalizePaid(payment._id, '');
    return res.status(201).json({ success: true, data: { paymentId: payment._id, free: true } });
  }

  if (!geidea.isConfigured()) {
    res.status(503);
    throw new Error('Online payment is not available right now. Please try again later.');
  }
  const backendUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
  if (!backendUrl) {
    res.status(500);
    throw new Error('BACKEND_URL is not configured on the server');
  }

  const sessionId = await geidea.createSession({
    amount,
    currency,
    merchantReferenceId: payment.merchantReferenceId,
    callbackUrl: `${backendUrl}/api/payments/callback`,
    language: language === 'ar' ? 'ar' : 'en',
    customer: req.user.email ? { email: req.user.email } : undefined,
  });

  payment.sessionId = sessionId;
  await payment.save();

  res.status(201).json({
    success: true,
    data: { paymentId: payment._id, sessionId, hppScriptUrl: geidea.getConfig().hppScriptUrl },
  });
};

// @desc    Called by the browser after the Geidea popup reports success; we re-verify with Geidea ourselves
// @route   POST /api/payments/:id/confirm
// @access  Private
const confirmPayment = async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment || String(payment.user) !== String(req.user._id)) {
    res.status(404);
    throw new Error('Payment not found');
  }
  const status = await verifyWithGeidea(payment);
  res.json({ success: true, data: { status } });
};

// @desc    Server-to-server notification from Geidea (webhook)
// @route   POST /api/payments/callback
// @access  Public (لكن مبنصدّق منه حاجة: بنسأل Geidea بنفسنا قبل ما نأكد أي دفع)
const handleCallback = async (req, res) => {
  const ref = req.body && req.body.order && req.body.order.merchantReferenceId;
  if (ref) {
    const payment = await Payment.findOne({ merchantReferenceId: String(ref) });
    if (payment) {
      try {
        await verifyWithGeidea(payment);
      } catch (err) {
        console.error('Geidea callback verification failed:', err.message);
        return res.status(500).json({ received: false });
      }
    }
  }
  res.status(200).json({ received: true });
};

module.exports = { createPaymentSession, confirmPayment, handleCallback };
