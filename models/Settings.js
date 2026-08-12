const mongoose = require('mongoose');

// موديل واحد بس (سجل واحد) بيحتفظ بإعدادات عامة للموقع قابلة للتعديل من الأدمن
// بدل ما تتحط ثابتة في الكود وتحتاج Deploy جديد كل مرة تتغيّر
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'general', unique: true },
    // سعر تحويل اليورو للجنيه المصري - بيُستخدم وقت تحصيل الدفع الفعلي عبر Paymob
    // (العرض للزائر يفضل باليورو، لكن التحصيل الحقيقي بيتحول لجنيه بالسعر ده أولًا)
    eurToEgpRate: { type: Number, default: 60, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
