const Order = require('../models/Order');
const Booking = require('../models/Booking');
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

// @desc    Create an order (called from checkout after a purchase is completed)
// @route   POST /api/orders
// @access  Private (must be logged in - checkout already requires it)
const createOrder = async (req, res) => {
  const { customerName, phone, address, governorate, items, totalAmount } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Order must include at least one item');
  }

  const order = await Order.create({
    user: req.user._id,
    customerName: customerName || req.user.name,
    phone,
    address,
    governorate,
    items,
    totalAmount,
    country: req.headers['x-vercel-ip-country'] || 'Unknown',
  });

  let paymentUrl = null;

  if (paymobConfigured()) {
    try {
      // بنستخدم نفس دالة الحجز، بس بنمرر له { price, student } بدل الـ booking
      const paymentData = await createPaymobPaymentIntent({
        price: totalAmount,
        student: req.user._id,
      });
      order.paymobOrderId = paymentData.orderId;
      order.paymobPaymentKey = paymentData.paymentKey;
      await order.save();

      if (process.env.PAYMOB_IFRAME_ID) {
        paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentData.paymentKey}`;
      }
    } catch (err) {
      console.error('Paymob Error (order):', err.message);
    }
  } else {
    // وضع التطوير: مفيش مفاتيح Paymob متظبطة، نعتبر الطلب مدفوع مباشرة
    order.status = 'paid';
    await order.save();
  }

  res.status(201).json({ success: true, data: { order, paymentUrl } });
};

// @desc    List orders (most recent first)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, count: orders.length, data: orders });
};

// @desc    Revenue + top-selling products summary
// @route   GET /api/orders/stats/summary
// @access  Private/Admin
const getOrderStats = async (req, res) => {
  const [totals] = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  const topProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.title',
        quantitySold: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 5 },
  ]);

  // إيرادات آخر 30 يوم مقسّمة بالتاريخ - عشان رسم بياني في الداشبورد
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const dailyRevenueAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // نملى أي يوم مفيهوش طلبات بصفر عشان الرسم البياني يبقى متصل صح
  const dailyRevenueMap = new Map(dailyRevenueAgg.map((d) => [d._id, d]));
  const dailyRevenue = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const found = dailyRevenueMap.get(key);
    dailyRevenue.push({
      date: key,
      revenue: found ? found.revenue : 0,
      orders: found ? found.orders : 0,
    });
  }

  // الإيرادات حسب نوع المنتج (فيزيكال / ديجيتال) من الطلبات + جلسات الحجز المدفوعة
  const revenueByItemType = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.type',
        revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
      },
    },
  ]);

  const [bookingRevenueAgg] = await Booking.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, revenue: { $sum: '$price' } } },
  ]);

  const revenueByType = [
    ...revenueByItemType.map((t) => ({ type: t._id || 'physical', revenue: t.revenue })),
    { type: 'booking', revenue: bookingRevenueAgg ? bookingRevenueAgg.revenue : 0 },
  ];

  res.json({
    success: true,
    data: {
      totalRevenue: totals ? totals.totalRevenue : 0,
      totalOrders: totals ? totals.totalOrders : 0,
      topProducts: topProducts.map((p) => ({
        title: p._id,
        quantitySold: p.quantitySold,
        revenue: p.revenue,
      })),
      dailyRevenue,
      revenueByType,
    },
  });
};

// @desc    Paymob webhook - marks an order as paid once payment is confirmed
// @route   POST /api/orders/paymob-callback
// @access  Public (called by Paymob's servers)
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

    const order = await Order.findOne({ paymobOrderId: String(orderId) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = 'paid';
    await order.save();

    res.json({ success: true, message: 'Order payment confirmed' });
  } catch (error) {
    console.error('Paymob callback error (order):', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createOrder, getOrders, getOrderStats, paymobCallback };
