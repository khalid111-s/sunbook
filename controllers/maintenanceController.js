const Order = require('../models/Order');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const PromoCode = require('../models/PromoCode');
const User = require('../models/User');
const Visit = require('../models/Visit');
const ActiveVisitor = require('../models/ActiveVisitor');
const Event = require('../models/Event');

// أنواع البيانات المسموح مسحها من "Danger Zone"، وإيه اللي بيتشال فعليًا في كل نوع.
// عمدًا: المنتجات (Products)، حسابات الأدمن، والإعدادات (Settings) مش موجودين هنا خالص - مينفعش يتمسحوا من هنا أبدًا.
const WIPE_HANDLERS = {
  orders: async () => {
    const result = await Order.deleteMany({});
    return result.deletedCount;
  },
  bookings: async () => {
    const bookings = await Booking.deleteMany({});
    const sessions = await Session.deleteMany({});
    return bookings.deletedCount + sessions.deletedCount;
  },
  promocodes: async () => {
    const result = await PromoCode.deleteMany({});
    return result.deletedCount;
  },
  users: async () => {
    // مينفعش نمسح أي حساب admin من هنا مهما حصل - حتى لو حد ضغط بالغلط
    const result = await User.deleteMany({ role: { $ne: 'admin' } });
    return result.deletedCount;
  },
  analytics: async () => {
    const visits = await Visit.deleteMany({});
    const active = await ActiveVisitor.deleteMany({});
    const events = await Event.deleteMany({});
    return visits.deletedCount + active.deletedCount + events.deletedCount;
  },
};

// @desc    مسح أنواع بيانات معينة (تيست) قبل ما توصل للزباين الحقيقيين - Danger Zone
//          محمي بمفتاح سري (ADMIN_SETUP_KEY) + لازم تبعت "types" بالظبط اللي عايز تمسحه.
//          مفيش أي مسح تلقائي لحاجة متطلبتش صراحة، والمنتجات وحسابات الأدمن والإعدادات مش قابلين للمسح من هنا خالص.
// @route   POST /api/maintenance/wipe-data
// @access  Public (لكن لازم تعرف الـ setupKey الصح)
const wipeData = async (req, res) => {
  const { types, setupKey } = req.body;

  if (!process.env.ADMIN_SETUP_KEY) {
    res.status(403);
    throw new Error('Admin setup is not configured on the server. Add ADMIN_SETUP_KEY to your backend environment variables first.');
  }

  if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
    res.status(401);
    throw new Error('Invalid setup key.');
  }

  if (!Array.isArray(types) || !types.length) {
    res.status(400);
    throw new Error('Choose at least one data type to wipe.');
  }

  const invalidTypes = types.filter((t) => !WIPE_HANDLERS[t]);
  if (invalidTypes.length) {
    res.status(400);
    throw new Error(`Unknown data type(s): ${invalidTypes.join(', ')}`);
  }

  const results = {};
  for (const type of types) {
    results[type] = await WIPE_HANDLERS[type]();
  }

  res.json({ success: true, data: results });
};

module.exports = { wipeData };
