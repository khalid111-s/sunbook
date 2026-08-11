const mongoose = require('mongoose');

// بيسجّل نقرات مهمة في الموقع (زي زرار Add to Cart) عشان نعرف أكتر حاجة الناس بتتفاعل معاها
const eventSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // مثلاً: 'add_to_cart'
    targetTitle: { type: String, default: '' }, // اسم المنتج أو العنصر اللي اتضغط عليه
    visitorId: { type: String, required: true },
  },
  { timestamps: true }
);

eventSchema.index({ label: 1, targetTitle: 1 });

module.exports = mongoose.model('Event', eventSchema);
