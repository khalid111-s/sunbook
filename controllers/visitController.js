const Visit = require('../models/Visit');
const ActiveVisitor = require('../models/ActiveVisitor');
const { getDateRange, dateFormatForUnit, keyForDate, buildBuckets } = require('../utils/dateRange');

// كام ثانية نعتبر بعدها الزائر "خرج" لو مبعتش heartbeat جديد
const ONLINE_WINDOW_MS = 90 * 1000;

// @desc    Log a page view (fired from the frontend on every page load)
// @route   POST /api/visits
// @access  Public
const logVisit = async (req, res) => {
  const { path, visitorId, referrer } = req.body;

  if (!visitorId) {
    res.status(400);
    throw new Error('visitorId is required');
  }

  // Vercel بيحط هيدر بلد الزائر تلقائيًا على كل request واصل للسيرفر - مجاني ومن غير أي API خارجي
  const country = req.headers['x-vercel-ip-country'] || 'Unknown';

  await Visit.create({ path, country, visitorId, referrer: referrer || 'direct' });
  res.status(201).json({ success: true });
};

// @desc    Heartbeat - fired every ~25s while a tab is open, so we know who's online right now
// @route   POST /api/visits/heartbeat
// @access  Public
const heartbeat = async (req, res) => {
  const { visitorId, path } = req.body;
  if (!visitorId) {
    res.status(400);
    throw new Error('visitorId is required');
  }

  await ActiveVisitor.findOneAndUpdate(
    { visitorId },
    { visitorId, path, lastSeen: new Date() },
    { upsert: true }
  );

  res.json({ success: true });
};

// @desc    How many visitors are currently on the site
// @route   GET /api/visits/online
// @access  Private/Admin
const getOnlineCount = async (req, res) => {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const count = await ActiveVisitor.countDocuments({ lastSeen: { $gte: cutoff } });
  res.json({ success: true, data: { online: count } });
};

// @desc    Visitor + pageview stats for the admin dashboard
// @route   GET /api/visits/stats
// @access  Private/Admin
const getVisitStats = async (req, res) => {
  const totalPageViews = await Visit.countDocuments();
  const uniqueVisitorIds = await Visit.distinct('visitorId');
  const totalUniqueVisitors = uniqueVisitorIds.length;

  const topCountriesAgg = await Visit.aggregate([
    { $group: { _id: { country: '$country', visitorId: '$visitorId' } } },
    { $group: { _id: '$_id.country', visitors: { $sum: 1 } } },
    { $sort: { visitors: -1 } },
    { $limit: 10 },
  ]);

  // مصادر الزيارات (Referrers) - عدد الزوار الفريدين لكل مصدر
  const topReferrersAgg = await Visit.aggregate([
    { $group: { _id: { referrer: '$referrer', visitorId: '$visitorId' } } },
    { $group: { _id: '$_id.referrer', visitors: { $sum: 1 } } },
    { $sort: { visitors: -1 } },
    { $limit: 10 },
  ]);

  // زوار جدد (زاروا مرة واحدة بس) مقابل زوار راجعين (زاروا أكتر من مرة)
  const visitCountsPerVisitor = await Visit.aggregate([
    { $group: { _id: '$visitorId', visits: { $sum: 1 } } },
  ]);
  const newVisitors = visitCountsPerVisitor.filter((v) => v.visits === 1).length;
  const returningVisitors = visitCountsPerVisitor.filter((v) => v.visits > 1).length;

  // عدد الزوار الفريدين اللي وصلوا لصفحة الـ checkout (بنستخدمه لحساب السلة المتروكة)
  const checkoutVisitorIds = await Visit.distinct('visitorId', {
    path: { $regex: 'checkout', $options: 'i' },
  });

  // زيارات الفترة المطلوبة (يوم/أسبوع/شهر/سنة) - عشان رسم بياني عام للموقع
  const granularity = ['day', 'week', 'month', 'year'].includes(req.query.granularity)
    ? req.query.granularity
    : 'month';
  const { start, end, unit, bucketCount } = getDateRange(granularity, req.query.date);

  const dailyVisitsAgg = await Visit.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormatForUnit(unit), date: '$createdAt' } },
        pageViews: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
  ]);
  const dailyVisitsMap = new Map(
    dailyVisitsAgg.map((d) => [d._id, { pageViews: d.pageViews, visitors: d.visitors.length }])
  );
  const buckets = buildBuckets(start, unit, bucketCount);
  const dailyVisits = buckets.map((d) => {
    const key = keyForDate(d, unit);
    const found = dailyVisitsMap.get(key);
    return {
      date: key,
      pageViews: found ? found.pageViews : 0,
      visitors: found ? found.visitors : 0,
    };
  });

  res.json({
    success: true,
    data: {
      totalPageViews,
      totalUniqueVisitors,
      newVisitors,
      returningVisitors,
      checkoutVisitors: checkoutVisitorIds.length,
      topCountries: topCountriesAgg.map((c) => ({
        country: c._id || 'Unknown',
        visitors: c.visitors,
      })),
      topReferrers: topReferrersAgg.map((r) => ({
        referrer: r._id || 'direct',
        visitors: r.visitors,
      })),
      dailyVisits,
      granularity,
      seriesUnit: unit,
      rangeStart: start,
      rangeEnd: end,
    },
  });
};

module.exports = { logVisit, heartbeat, getOnlineCount, getVisitStats };
