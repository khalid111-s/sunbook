const Order = require('../models/Order');
const Booking = require('../models/Booking');
const PromoCode = require('../models/PromoCode');
const Product = require('../models/Product');
const { isKashierConfigured, createKashierPaymentIntent, verifyKashierWebhookSignature, queryKashierOrder, refundKashierTransaction } = require('../utils/kashier');
const { getDateRange, dateFormatForUnit, keyForDate, buildBuckets } = require('../utils/dateRange');
const { getOrCreateSettings } = require('./settingsController');
const { sendOrderConfirmationEmail, sendNewOrderAdminAlert, sendOrderCancelledEmail } = require('../utils/email');

// بيحدّث حالة الطلب لـ "paid" ويبعت إيميلات التأكيد/التنبيه مرة واحدة بس، مهما كانت الطريقة اللي
// عرفنا بيها إن الدفع نجح (webhook، فحص مباشر، أو وضع التطوير من غير بوابة دفع)
const markOrderPaidAndNotify = async (order) => {
  order.status = 'paid';
  if (!order.confirmationEmailSent) {
    order.confirmationEmailSent = true;
    await order.save();
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
  } else {
    await order.save();
  }
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

    if (promo.perUserLimit) {
      const timesUsedByThisUser = promo.usedBy.filter((u) => u.toString() === req.user._id.toString()).length;
      if (timesUsedByThisUser >= promo.perUserLimit) {
        res.status(400);
        throw new Error("You've already used this promo code the maximum number of times allowed");
      }
    }

    discountAmount =
      promo.discountType === 'percentage'
        ? (totalAmount * promo.discountValue) / 100
        : Math.min(promo.discountValue, totalAmount);
    discountAmount = Math.round(discountAmount * 100) / 100;
    finalAmount = Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100);
    appliedPromoCode = promo.code;

    promo.timesUsed += 1;
    promo.usedBy.push(req.user._id);
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

  let paymentUrl = null;

  // --- Kashier (بيدعم EGP/USD/GBP/EUR بشكل مباشر، من غير أي تحويل يدوي) ---
  if (isKashierConfigured()) {
    try {
      const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
      const merchantRedirect = encodeURIComponent(`${frontendBase}/checkout.html?kashier_return=1&order=${order._id}`);

      const paymentData = createKashierPaymentIntent({
        orderId: order._id.toString(),
        amount: finalAmount,
        currency: orderCurrency,
        merchantRedirect,
      });

      order.kashierHash = paymentData.hash;
      await order.save();
      paymentUrl = paymentData.redirectUrl;
    } catch (err) {
      console.error('Kashier Error (order):', err.response?.data || err.message);
    }
  }

  // --- وضع التطوير: مفيش بوابة دفع متظبطة، نعتبر الطلب مدفوع مباشرة عشان تكمل تجربة الموقع ---
  if (!paymentUrl && !isKashierConfigured()) {
    await markOrderPaidAndNotify(order);
  }

  res.status(201).json({ success: true, data: { order, paymentUrl } });
};

// @desc    Customer cancels their own physical order and gets a refund - only allowed while
//          the order hasn't shipped yet. Digital-only orders can never be cancelled since the
//          customer already has access to the files the moment they pay.
// @route   PATCH /api/orders/:id/cancel
// @access  Private (order owner only)
const cancelOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.status === 'cancelled') {
    res.status(400);
    throw new Error('Order is already cancelled');
  }

  const hasPhysicalItem = order.items.some((i) => i.type === 'physical');
  if (!hasPhysicalItem) {
    res.status(400);
    throw new Error('Digital orders cannot be cancelled since the files are delivered immediately upon payment');
  }

  if (order.fulfillmentStatus !== 'processing') {
    res.status(400);
    throw new Error('This order has already shipped and can no longer be cancelled');
  }

  // لو كان مدفوع فعليًا، نرجّع الفلوس قبل ما نلغي رسميًا
  if (order.status === 'paid' && order.kashierOrderId) {
    try {
      const refundResult = await refundKashierTransaction({
        kashierOrderId: order.kashierOrderId,
        amount: order.totalAmount,
        reason: 'Order cancelled by customer',
      });
      if (!refundResult.success) {
        console.error('Refund did not succeed for order', order._id, refundResult.raw);
      }
    } catch (err) {
      console.error('Refund request failed for order', order._id, err.response?.data || err.message);
      res.status(500);
      throw new Error('Could not process the refund right now. Please contact support.');
    }
  }

  // نرجّع كل الكتب الفيزيكال اللي في الطلب ده للمخزون (لو كان بيتتبّع فعليًا)
  for (const item of order.items) {
    if (item.type === 'physical' && item.product) {
      const product = await Product.findById(item.product);
      if (product && product.trackStock) {
        await Product.findByIdAndUpdate(product._id, { $inc: { stockCount: item.qty } });
      }
    }
  }

  order.status = 'cancelled';
  await order.save();

  try {
    await sendOrderCancelledEmail(order);
  } catch (err) {
    console.error('Order cancellation email failed:', err.message);
  }

  res.json({ success: true, data: order });
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

// @desc    Kashier webhook - marks an order as paid (or refunded) once payment is confirmed
// @route   POST /api/orders/kashier-webhook
// @access  Public (called by Kashier's servers, server-to-server, signed with x-kashier-signature)
const kashierWebhook = async (req, res) => {
  try {
    const { event, data } = req.body || {};
    if (!data || !data.merchantOrderId) {
      return res.status(400).json({ message: 'Invalid webhook data' });
    }

    const signature = req.header('x-kashier-signature');
    if (!verifyKashierWebhookSignature(data, signature)) {
      console.error('Kashier webhook: invalid signature for order', data.merchantOrderId);
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const order = await Order.findById(data.merchantOrderId).catch(() => null);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // بنسجّل orderId الداخلي بتاع Kashier (مش نفس معرّف الطلب عندنا) - محتاجينه لو عملنا refund بعدين
    if (data.kashierOrderId || data.orderId) {
      order.kashierOrderId = data.kashierOrderId || data.orderId;
    }

    if (event === 'pay' && data.status === 'SUCCESS') {
      await markOrderPaidAndNotify(order);
    } else if (event === 'pay') {
      order.status = 'cancelled';
      await order.save();
    } else {
      await order.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Kashier webhook error (order):', error);
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

  // لو الطلب لسه "pending"، نسأل Kashier مباشرة عن الحالة الحقيقية بدل ما نستنى
  // الإشعار (webhook) بس - ده بيحل مشكلة إشعارات ماوصلتش أو اتأخرت
  if (order.status === 'pending' && isKashierConfigured()) {
    try {
      const result = await queryKashierOrder(order._id.toString());
      const orderStatus = result?.response?.status; // 'CAPTURED' = نجح
      if (orderStatus === 'CAPTURED') {
        if (result?.response?.orderId) order.kashierOrderId = result.response.orderId;
        await markOrderPaidAndNotify(order);
      } else if (['FAILED', 'DECLINED', 'VOIDED'].includes(orderStatus)) {
        order.status = 'cancelled';
        await order.save();
      }
      // أي حالة تانية (لسه معلّقة) بنسيبها pending ونجرب تاني بعدين
    } catch (err) {
      console.error('Kashier live status check failed:', err.response?.data || err.message);
      // مش هنوقف الطلب لو الاستعلام فشل - هنرجع بحالة الطلب الحالية زي ما هي
    }
  }

  res.json({ success: true, data: order });
};

module.exports = {
  createOrder,
  cancelOrder,
  getOrders,
  getMyOrders,
  updateOrderFulfillment,
  getOrderById,
  getOrderStats,
  kashierWebhook,
};
