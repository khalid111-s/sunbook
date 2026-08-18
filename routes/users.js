const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');

// اللي بيحجز جلسة بيتوجّه لأول حساب يرجع من الاستعلام ده. لو محدد TEACHER_EMAIL في الإعدادات،
// بنرجّع بس صاحب الإيميل ده (سواء كان role='teacher' أو 'admin') عشان نضمن حساب واحد ثابت
// بيستقبل كل الحجوزات، من غير ما نتلخبط لو فيه أكتر من حساب مؤهل.
router.get('/teachers/list', async (req, res) => {
  let teachers;
  if (process.env.TEACHER_EMAIL) {
    teachers = await User.find({
      email: process.env.TEACHER_EMAIL,
      role: { $in: ['teacher', 'admin'] },
    }).select('name email avatar');
  } else {
    teachers = await User.find({ role: { $in: ['teacher', 'admin'] } }).select('name email avatar');
  }
  res.json({ success: true, count: teachers.length, data: teachers });
});

// @desc    طريقة أسهل من تشغيل سكريبت في الـ terminal: تحويل حساب مسجّل بالفعل لـ admin
//          عن طريق صفحة ويب (admin-setup.html) بدل ما تدخل السيرفر وتكتب أوامر.
//          محمي بمفتاح سري (ADMIN_SETUP_KEY) لازم تحطه إنت في الـ Environment Variables بتاعة الباك إند،
//          عشان محدش تاني غير اللي عنده المفتاح ده يقدر يعمل نفسه admin.
//          بيسمح بـ admin واحد بس: أي حساب تاني كان admin هيترجع تلقائيًا "student".
// @route   POST /api/users/promote-admin
// @access  Public (لكن لازم تعرف الـ setupKey الصح)
router.post('/promote-admin', async (req, res) => {
  const { email, setupKey } = req.body;

  if (!process.env.ADMIN_SETUP_KEY) {
    res.status(403);
    throw new Error('Admin setup is not configured on the server. Add ADMIN_SETUP_KEY to your backend environment variables first.');
  }

  if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
    res.status(401);
    throw new Error('Invalid setup key.');
  }

  if (!email) {
    res.status(400);
    throw new Error('Email is required.');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    res.status(404);
    throw new Error('No account found with this email. Register a normal account on the site first, then try again.');
  }

  // نضمن admin واحد بس: أي حساب تاني كان admin يترجع "student"
  await User.updateMany({ role: 'admin', _id: { $ne: user._id } }, { $set: { role: 'student' } });

  user.role = 'admin';
  await user.save();

  res.json({ success: true, data: { name: user.name, email: user.email, role: user.role } });
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
