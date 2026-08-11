const Event = require('../models/Event');

// @desc    Log a click event (e.g. "Add to Cart" clicked on a product)
// @route   POST /api/events
// @access  Public
const logEvent = async (req, res) => {
  const { label, targetTitle, visitorId } = req.body;

  if (!label || !visitorId) {
    res.status(400);
    throw new Error('label and visitorId are required');
  }

  await Event.create({ label, targetTitle: targetTitle || '', visitorId });
  res.status(201).json({ success: true });
};

// @desc    Most-clicked targets for a given label (e.g. top clicked "Add to Cart" products)
// @route   GET /api/events/stats/clicks?label=add_to_cart
// @access  Private/Admin
const getClickStats = async (req, res) => {
  const label = req.query.label || 'add_to_cart';

  const topClicked = await Event.aggregate([
    { $match: { label, targetTitle: { $ne: '' } } },
    { $group: { _id: '$targetTitle', clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: 10 },
  ]);

  res.json({
    success: true,
    data: {
      label,
      topClicked: topClicked.map((c) => ({ title: c._id, clicks: c.clicks })),
    },
  });
};

module.exports = { logEvent, getClickStats };
