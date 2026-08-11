const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
    path: { type: String, default: '' },
    // مصدر الزيارة: direct / google / facebook / instagram / other
    referrer: { type: String, default: 'direct' },
    // بيجي تلقائي من هيدر Vercel (x-vercel-ip-country) - مجاني ومن غير أي خدمة خارجية
    country: { type: String, default: 'Unknown' },
    // معرّف عشوائي بيتولّد في المتصفح ويتخزن في localStorage عشان نفرّق زائر جديد عن زائر راجع
    visitorId: { type: String, required: true },
  },
  { timestamps: true }
);

visitSchema.index({ visitorId: 1 });
visitSchema.index({ country: 1 });

module.exports = mongoose.model('Visit', visitSchema);
