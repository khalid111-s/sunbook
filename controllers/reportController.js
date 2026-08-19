const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// @desc    قايمة كل الشهور اللي فيها بيانات (طلبات أو حجوزات) عشان نعرضها في تاب Archives - من أحدث شهر لأقدم شهر فيه بيانات
// @route   GET /api/reports/months
// @access  Private/Admin
const getAvailableMonths = async (req, res) => {
  const [oldestOrder] = await Order.find().sort({ createdAt: 1 }).limit(1).select('createdAt');
  const [oldestBooking] = await Booking.find().sort({ createdAt: 1 }).limit(1).select('createdAt');

  const candidates = [oldestOrder?.createdAt, oldestBooking?.createdAt].filter(Boolean);
  if (!candidates.length) {
    res.json({ success: true, data: [] });
    return;
  }

  const earliest = new Date(Math.min(...candidates.map((d) => new Date(d).getTime())));
  const now = new Date();

  const months = [];
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const floor = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));

  while (cursor >= floor) {
    months.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1, // 1-12
      label: `${MONTH_NAMES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  }

  res.json({ success: true, data: months });
};

// @desc    كل أرقام شهر معين (طلبات، حجوزات، مستخدمين جداد) - الفرونت إند بيبني منها ملف PDF قابل للتنزيل
// @route   GET /api/reports/monthly/:year/:month
// @access  Private/Admin
const getMonthlyReportData = async (req, res) => {
  const year = parseInt(req.params.year, 10);
  const month = parseInt(req.params.month, 10); // 1-12

  if (!year || !month || month < 1 || month > 12) {
    res.status(400);
    throw new Error('Invalid year or month.');
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const [orderTotals] = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
  ]);

  const ordersByStatus = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const topProducts = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
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

  const [bookingTotals] = await Booking.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: { $cond: [{ $in: ['$status', ['paid', 'confirmed', 'completed']] }, '$price', 0] },
        },
        totalBookings: { $sum: 1 },
      },
    },
  ]);

  const bookingsByStatus = await Booking.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const newUsers = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });

  res.json({
    success: true,
    data: {
      year,
      month,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      orders: {
        totalRevenue: orderTotals ? orderTotals.totalRevenue : 0,
        totalOrders: orderTotals ? orderTotals.totalOrders : 0,
        byStatus: ordersByStatus.map((s) => ({ status: s._id || 'unknown', count: s.count })),
      },
      topProducts: topProducts.map((p) => ({ title: p._id, quantitySold: p.quantitySold, revenue: p.revenue })),
      bookings: {
        totalRevenue: bookingTotals ? bookingTotals.totalRevenue : 0,
        totalBookings: bookingTotals ? bookingTotals.totalBookings : 0,
        byStatus: bookingsByStatus.map((s) => ({ status: s._id || 'unknown', count: s.count })),
      },
      newUsers,
    },
  });
};

module.exports = { getAvailableMonths, getMonthlyReportData };
