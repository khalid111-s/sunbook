const Order = require('../models/Order');
const Booking = require('../models/Booking');
const { markOrderPaidAndNotify } = require('./orderController');
const { markBookingPaidAndNotify } = require('./bookingController');
const {
  verifyPaidWebhook,
  verifyFailedWebhook,
  verifyCancelWebhook,
} = require('../utils/fawaterak');

// ==========================================================================
// نقطة استقبال واحدة موحّدة لكل إشعارات (webhooks) فواتيرك، للطلبات والحجوزات مع بعض.
// السبب: فواتيرك بتدّيك خانة واحدة بس لكل نوع حدث (Paid/Failed/Cancel) في لوحة التحكم -
// هي مش عارفة أصلًا إن عندك "طلبات" و"حجوزات" كمفهومين منفصلين، ده تقسيم خاص بموقعك إنت.
// فبدل ما نضطر لخانتين والتحكم يقبل واحدة بس، بنستقبل كل حاجة هنا، وبنبص جوه
// الـ pay_load (اللي إحنا حطيناه بنفسنا وقت إنشاء كل معاملة) عشان نعرف نوجهها صح.
// ==========================================================================

function extractIds(body) {
  let payload = {};
  try {
    payload = JSON.parse(body.pay_load || '{}');
  } catch {
    payload = {};
  }
  return { orderId: payload.order_id || null, bookingId: payload.booking_id || null };
}

const paidWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    if (!verifyPaidWebhook(body)) {
      console.error('Fawaterak paid webhook: invalid signature');
      return res.status(401).json({ status: 'error' });
    }

    const { orderId, bookingId } = extractIds(body);

    if (orderId) {
      const order = await Order.findById(orderId).catch(() => null);
      if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
      order.fawaterakTransactionId = String(body.transaction_id);
      if (body.status === 'paid') {
        await markOrderPaidAndNotify(order);
      } else {
        await order.save(); // status === 'pending' (فوري/أمان لسه العميل ما دفعش في الفرع)
      }
    } else if (bookingId) {
      const booking = await Booking.findById(bookingId).catch(() => null);
      if (!booking) return res.status(404).json({ status: 'error', message: 'Booking not found' });
      booking.fawaterakTransactionId = String(body.transaction_id);
      if (body.status === 'paid') {
        await markBookingPaidAndNotify(booking);
      } else {
        await booking.save();
      }
    } else {
      return res.status(400).json({ status: 'error', message: 'Missing order_id/booking_id in pay_load' });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Fawaterak paid webhook error:', error);
    res.status(500).json({ status: 'error' });
  }
};

const failedWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    if (!verifyFailedWebhook(body)) {
      console.error('Fawaterak failed webhook: invalid signature');
      return res.status(401).json({ status: 'error' });
    }

    const { orderId, bookingId } = extractIds(body);

    if (orderId) {
      const order = await Order.findById(orderId).catch(() => null);
      if (order && order.status !== 'paid') {
        order.status = 'cancelled';
        await order.save();
      }
    } else if (bookingId) {
      const booking = await Booking.findById(bookingId).catch(() => null);
      if (booking && booking.status !== 'paid') {
        booking.status = 'cancelled';
        await booking.save();
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Fawaterak failed webhook error:', error);
    res.status(500).json({ status: 'error' });
  }
};

const cancelWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    if (!verifyCancelWebhook(body)) {
      console.error('Fawaterak cancel webhook: invalid signature');
      return res.status(401).json({ status: 'error' });
    }

    const { orderId, bookingId } = extractIds(body);

    if (orderId) {
      const order = await Order.findById(orderId).catch(() => null);
      if (order && order.status !== 'paid') {
        order.status = 'cancelled';
        await order.save();
      }
    } else if (bookingId) {
      const booking = await Booking.findById(bookingId).catch(() => null);
      if (booking && booking.status !== 'paid') {
        booking.status = 'cancelled';
        await booking.save();
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Fawaterak cancel webhook error:', error);
    res.status(500).json({ status: 'error' });
  }
};

module.exports = { paidWebhook, failedWebhook, cancelWebhook };
