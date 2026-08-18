const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'غير مصرح، المستخدم غير موجود' });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ message: 'غير مصرح، التوكن غير صالح' });
    }
  }

  return res.status(401).json({ message: 'غير مصرح، لا يوجد توكن' });
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية للوصول' });
    }
    next();
  };
};

// زي protect بالظبط، بس مش بترفض الطلب لو مفيش توكن أو كان غلط - بس بتحاول تعرف مين المستخدم لو ممكن.
// مفيدة للـ endpoints العامة اللي محتاجة تتصرف مختلف شوية لو المستخدم مسجل دخول (زي فحص حد الاستخدام الشخصي لكود خصم)
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      req.user = null;
    }
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
