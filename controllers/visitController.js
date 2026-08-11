const Visit = require('../models/Visit');

// @desc    Log a page view (fired from the frontend on every page load)
// @route   POST /api/visits
// @access  Public
const logVisit = async (req, res) => {
  const { path, visitorId } = req.body;

  if (!visitorId) {
    res.status(400);
    throw new Error('visitorId is required');
  }

  // Vercel بيحط هيدر بلد الزائر تلقائيًا على كل request واصل للسيرفر - مجاني ومن غير أي API خارجي
  const country = req.headers['x-vercel-ip-country'] || 'Unknown';

  await Visit.create({ path, country, visitorId });
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

  res.json({
    success: true,
    data: {
      totalPageViews,
      totalUniqueVisitors,
      topCountries: topCountriesAgg.map((c) => ({
        country: c._id || 'Unknown',
        visitors: c.visitors,
      })),
    },
  });
};

module.exports = { logVisit, getVisitStats };
