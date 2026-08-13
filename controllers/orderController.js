const Order = require('../models/Order');
const Booking = require('../models/Booking');
const { createPaymobPaymentIntent } = require('../utils/paymob');
const { createPaytabsPaymentIntent, isPaytabsConfigured } = require('../utils/paytabs');
const { getDateRange, dateFormatForUnit, keyForDate, buildBuckets } = require('../utils/dateRange');
const { getOrCreateSettings } = require('./settingsController');

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
  const { customerName, phone, address, governorate, items, totalAmount, currency } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Order must include at least one item');
  }

  const orderCurrency = currency === 'EUR' ? 'EUR' : 'EGP';

  const order = await Order.create({
    user: req.user._id,
    customerName: customerName || req.user.name,
    phone,
    address,
    governorate,
    items,
    totalAmount,
    currency: orderCurrency,
    country: req.headers['x-vercel-ip-country'] || 'Unknown',
  });

  let paymentUrl = null;

  // --- الأولوية 1: PayTabs (بيدعم يورو حقيقي، مش تحويل يدوي) ---
  if (isPaytabsConfigured()) {
    try {
      const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
      const backendBase = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

      const paymentData = await createPaytabsPaymentIntent({
        amount: totalAmount,
        currency: orderCurrency,
        cartId: order._id.toString(),
        description: items.map((i) => i.title).join(', ').slice(0, 250),
        customer: {
          name: customerName || req.user.name,
          email: req.user.email,
          phone,
          street: address,
          city: governorate,
          country: order.country === 'EG' ? 'EG' : (order.country || 'EG'),
          ip: req.ip,
        },
        callbackUrl: `${backendBase}/api/orders/paytabs-callback`,
        returnUrl: `${backendBase}/api/orders/paytabs-return?order=${order._id}`,
      });

      order.paytabsTranRef = paymentData.tranRef;
      await order.save();
      paymentUrl = paymentData.redirectUrl;
    } catch (err) {
      console.error('PayTabs Error (order):', err.response?.data || err.message);
    }
  }

  // --- الأولوية 2: Paymob كـ fallback (لسه شغال لحجز الجلسات، وممكن يشتغل هنا برضو) ---
  // ملحوظة: Paymob على حسابنا بيقبل جنيه بس، فلو الطلب باليورو لازم نحوّله لجنيه الأول
  // بسعر الصرف المسجل في الإعدادات، عشان منقعش في نفس مشكلة "التحصيل بالرقم غلط".
  if (!paymentUrl && paymobConfigured()) {
    try {
      let amountForPaymob = totalAmount;
      if (orderCurrency === 'EUR') {
        const settings = await getOrCreateSettings();
        amountForPaymob = Math.round(totalAmount * settings.eurToEgpRate * 100) / 100;
        order.chargedAmountEGP = amountForPaymob;
      }

      const paymentData = await createPaymobPaymentIntent({
        price: amountForPaymob,
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
  }

  // --- وضع التطوير: مفيش أي بوابة دفع متظبطة، نعتبر الطلب مدفوع مباشرة عشان تكمل تجربة الموقع ---
  if (!paymentUrl && !isPaytabsConfigured() && !paymobConfigured()) {
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

  // إيرادات الفترة المطلوبة (يوم/أسبوع/شهر/سنة) - عشان الرسم البياني في الداشبورد
  const granularity = ['day', 'week', 'month', 'year'].includes(req.query.granularity)
    ? req.query.granularity
    : 'month';
  const { start, end, unit, bucketCount } = getDateRange(granularity, req.query.date);

  const revenueAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormatForUnit(unit), date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
  ]);

  // نملى أي فترة مفيهاش طلبات بصفر عشان الرسم البياني يبقى متصل صح
  const revenueMap = new Map(revenueAgg.map((d) => [d._id, d]));
  const buckets = buildBuckets(start, unit, bucketCount);
  const dailyRevenue = buckets.map((d) => {
    const key = keyForDate(d, unit);
    const found = revenueMap.get(key);
    return {
      date: key,
      revenue: found ? found.revenue : 0,
      orders: found ? found.orders : 0,
    };
  });

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

  // كام طلب دفع بالجنيه المصري مقابل كام طلب دفع باليورو
  const ordersByCurrencyAgg = await Order.aggregate([
    { $group: { _id: '$currency', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
  ]);
  const ordersByCurrency = {
    EGP: { orders: 0, revenue: 0 },
    EUR: { orders: 0, revenue: 0 },
  };
  ordersByCurrencyAgg.forEach((c) => {
    const key = c._id === 'EUR' ? 'EUR' : 'EGP';
    ordersByCurrency[key] = { orders: c.orders, revenue: c.revenue };
  });

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
      granularity,
      seriesUnit: unit,
      rangeStart: start,
      rangeEnd: end,
      revenueByType,
      ordersByCurrency,
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

// @desc    PayTabs webhook - marks an order as paid once payment is confirmed
// @route   POST /api/orders/paytabs-callback
// @access  Public (called by PayTabs' servers, server-to-server)
const paytabsCallback = async (req, res) => {
  try {
    const body = req.body || {};
    // PayTabs بيبعت cart_id (بنبعته احنا وقت إنشاء الطلب = Order._id) وtran_ref ونتيجة الدفع
    const cartId = body.cart_id;
    const tranRef = body.tran_ref;
    const responseStatus = body.payment_result?.response_status; // 'A' = Approved

    if (!cartId && !tranRef) {
      return res.status(400).json({ message: 'Invalid callback data' });
    }

    const order = cartId
      ? await Order.findById(cartId).catch(() => null)
      : await Order.findOne({ paytabsTranRef: tranRef });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (responseStatus === 'A') {
      order.status = 'paid';
    } else {
      order.status = 'cancelled';
    }
    if (tranRef) order.paytabsTranRef = tranRef;
    await order.save();

    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    console.error('PayTabs callback error (order):', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single order (used by the checkout return page to confirm payment status)
// @route   GET /api/orders/:id
// @access  Private (owner or admin)
const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const isOwner = order.user && order.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }

  res.json({ success: true, data: order });
};

// @desc    Bridge endpoint for PayTabs' return redirect (which may use POST, unlike a
//          normal browser navigation) - static pages on Vercel reject POST with a 405,
//          so we catch it here first and bounce the browser to checkout.html with a GET.
// @route   ALL /api/orders/paytabs-return
// @access  Public
const paytabsReturnRedirect = (req, res) => {
  const orderId = req.query.order || req.body?.order || '';
  const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
  res.redirect(302, `${frontendBase}/checkout.html?paytabs_return=1&order=${orderId}`);
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  getOrderStats,
  paymobCallback,
  paytabsCallback,
  paytabsReturnRedirect,
};
