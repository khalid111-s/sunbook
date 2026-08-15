const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');

router.get('/teachers/list', async (req, res) => {
  const teachers = await User.find({ role: 'teacher' }).select('name email avatar');
  res.json({ success: true, count: teachers.length, data: teachers });
});

// @desc    List registered users with name, email, registration date, and how many orders each made
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();

  const orderCountsAgg = await Order.aggregate([
    { $group: { _id: '$user', orders: { $sum: 1 } } },
  ]);
  const orderCountMap = new Map(orderCountsAgg.map((o) => [String(o._id), o.orders]));

  const usersWithOrderCounts = users.map((u) => ({
    ...u,
    orderCount: orderCountMap.get(String(u._id)) || 0,
  }));

  res.json({ success: true, count: usersWithOrderCounts.length, data: usersWithOrderCounts });
});

router.get('/:id', protect, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ success: true, data: user });
});

module.exports = router;
