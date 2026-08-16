const Order = require('../models/Order');
const Booking = require('../models/Booking');
const PromoCode = require('../models/PromoCode');
const Product = require('../models/Product');
const { createPaymobPaymentIntent } = require('../utils/paymob');
const { createPaytabsPaymentIntent, isPaytabsConfigured, queryPaytabsTransaction } = require('../utils/paytabs');
const { getDateRange, dateFormatForUnit, keyForDate, buildBuckets } = require('../utils/dateRange');
const { getOrCreateSettings } = require('./settingsController');
const { sendOrderConfirmationEmail, sendNewOrderAdminAlert } = require('../utils/email');

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
  const { customerName, phone, address, governorate, items, totalAmount, currency, promoCode } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Order must include at least one item');
  }

  // --- التحقق من توفر المخزون للكتب الفيزيكال اللي بيتتبّع مخزونها فعليًا، قبل ما نأكد الطلب ---
  const physicalItemsWithProduct = items.filter((i) => i.type === 'physical' && i.product);
  const stockUpdates = [];
  for (const item of physicalItemsWithProduct) {
    const product = await Product.findById(item.product);
    if (product && product.trackStock) {
      if (product.stockCount < item.qty) {
        res.status(400);
        throw new Error(`"${product.title}" is out of stock (only ${product.stockCount} left).`);
      }
      stockUpdates.push({ id: product._id, qty: item.qty });
    }
  }

  const orderCurrency = currency === 'EUR' ? 'EUR' : 'EGP';

  // --- تطبيق كود الخصم (لو الفرونت بعت واحد) على الإجمالي قبل ما نسجّل الطلب ---
  let finalAmount = totalAmount;
  let discountAmount = 0;
  let appliedPromoCode = '';

  if (promoCode) {
    const promo = await PromoCode.findOne({ code: String(promoCode).trim().toUpperCase() });

    if (!promo || !promo.active) {
      res.status(404);
      throw new Error('Invalid promo code');
    }
    if (promo.expiresAt < new Date()) {
      res.status(400);
      throw new Error('This promo code has expired');
    }
    if (promo.usageLimit && promo.timesUsed >= promo.usageLimit) {
      res.status(400);
      throw new Error('This promo code has reached its usage limit');
    }

    discountAmount =
      promo.discountType === 'percentage'
        ? (totalAmount * promo.discountValue) / 100
        : Math.min(promo.discountValue, totalAmount);
    discountAmount = Math.round(discountAmount * 100) / 100;
    finalAmount = Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100);
    appliedPromoCode = promo.code;

    promo.timesUsed += 1;
    await promo.save();
  }

  const order = await Order.create({
    user: req.user._id,
    customerName: customerName || req.user.name,
    customerEmail: req.user.email,
    phone,
    address,
    governorate,
    items,
    totalAmount: finalAmount,
    promoCode: appliedPromoCode,
    discountAmount,
    currency: orderCurrency,
    country: req.headers['x-vercel-ip-country'] || 'Unknown',
  });

  // --- تنزيل المخزون فعليًا بعد ما اتأكد إنشاء الطلب ---
  for (const update of stockUpdates) {
    await Product.findByIdAndUpdate(update.id, { $inc: { stockCount: -update.qty } });
  }

  // --- إيميلات التأكيد والتنبيه - بنستناهم (Vercel بيوقف التنفيذ بعد الرد) بس في try/catch
  // عشان أي مشكلة في الإيميل (SMTP معطّل مثلاً) ميوقفش نجاح الطلب نفسه ---
  try {
    await sendOrderConfirmationEmail(order);
  } catch (err) {
    console.error('Order confirmation email failed:', err.message);
  }
  try {
    await sendNewOrderAdminAlert(order);
  } catch (err) {
    console.error('Admin order alert email failed:', err.message);
  }

  let paymentUrl = null;

  // --- الأولوية 1: PayTabs (بيدعم يورو حقيقي، مش تحويل يدوي) ---
  if (isPaytabsConfigured()) {
    try {
      const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
      const backendBase = process.env.BACKEND_URL || `https://${req.get('host')}`;

      const paymentData = await createPaytabsPaymentIntent({
        amount: finalAmount,
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
      let amountForPaymob = finalAmount;
      if (orderCurrency === 'EUR') {
        const settings = await getOrCreateSettings();
        amountForPaymob = Math.round(finalAmount * settings.eurToEgpRate * 100) / 100;
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

// @desc    List the logged-in user's own orders (used by the profile page for order tracking)
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: orders.length, data: orders });
};

// @desc    Update an order's fulfillment status (processing / shipped / delivered)
// @route   PATCH /api/orders/:id/fulfillment
// @access  Private/Admin
const updateOrderFulfillment = async (req, res) => {
  const { fulfillmentStatus } = req.body;
  const validStatuses = ['processing', 'shipped', 'delivered'];

  if (!validStatuses.includes(fulfillmentStatus)) {
    res.status(400);
    throw new Error('Invalid fulfillment status');
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { fulfillmentStatus },
    { new: true }
  );

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  res.json({ success: true, data: order });
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

  // لو الطلب لسه "pending" ومعاه مرجع PayTabs، نسأل PayTabs مباشرة عن الحالة الحقيقية
  // بدل ما نستنى الإشعار (webhook) بس - ده بيحل مشكلة إشعارات ماوصلتش أو اتأخرت
  if (order.status === 'pending' && order.paytabsTranRef) {
    try {
      const result = await queryPaytabsTransaction(order.paytabsTranRef);
      if (result.responseStatus === 'A') {
        order.status = 'paid';
        await order.save();
      } else if (['D', 'E', 'V'].includes(result.responseStatus)) {
        order.status = 'cancelled';
        await order.save();
      }
      // أي حالة تانية (زي 'H' معلّق أو 'P' لسه شغالة) بنسيبها pending ونجرب تاني بعدين
    } catch (err) {
      console.error('PayTabs live status check failed:', err.response?.data || err.message);
      // مش هنوقف الطلب لو الاستعلام فشل - هنرجع بحالة الطلب الحالية زي ما هي
    }
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
  getMyOrders,
  updateOrderFulfillment,
  getOrderById,
  getOrderStats,
  paymobCallback,
  paytabsCallback,
  paytabsReturnRedirect,
};
