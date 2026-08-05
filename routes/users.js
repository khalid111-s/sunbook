const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');

router.get('/teachers/list', async (req, res) => {
  const teachers = await User.find({ role: 'teacher' }).select('name email avatar');
  res.json({ success: true, count: teachers.length, data: teachers });
});

router.get('/', protect, authorize('admin'), async (req, res) => {
  const users = await User.find().select('-password');
  res.json({ success: true, count: users.length, data: users });
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
