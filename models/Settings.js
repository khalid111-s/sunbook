const mongoose = require('mongoose');

// موديل واحد بس (سجل واحد) بيحتفظ بإعدادات عامة للموقع قابلة للتعديل من الأدمن
// بدل ما تتحط ثابتة في الكود وتحتاج Deploy جديد كل مرة تتغيّر
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'general', unique: true },
    // سعر تحويل اليورو للجنيه المصري - كان بيُستخدم وقت التحصيل عبر Paymob (اللي كان بيقبل جنيه بس).
    // مبقاش مستخدم في التحصيل الفعلي مع Kashier لأنه بيقبل EUR مباشرة، لكن سايبينه لو احتجناه لعرض تقريبي.
    eurToEgpRate: { type: Number, default: 60, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
