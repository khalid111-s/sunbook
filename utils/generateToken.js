const jwt = require('jsonwebtoken');

// بيعمل JWT token للمستخدم بناءً على الـ id بتاعه
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;
