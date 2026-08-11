const Visit = require('../models/Visit');

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
    },
  });
};

module.exports = { logVisit, getVisitStats };
