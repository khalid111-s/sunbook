const mongoose = require('mongoose');

// النصوص الطويلة (المحتوى) القابلة للتعديل من الأدمن بالعربي والإنجليزي -
// زي إجابات الأسئلة الشائعة والسياسات وقصة الموقع - من غير ما نحتاج ديبلوي
// جديد كل مرة صاحب الموقع يحب يعدّل كلمة. النصوص التقنية (رسايل الأخطاء،
// حالات الأزرار...) لسه ثابتة في كود الفرونت إند عمدًا، مش هنا.
const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    group: { type: String, required: true }, // about | faq | policies | bookingDetails
    label: { type: String, required: true }, // اسم واضح للنص ده يظهر في لوحة التحكم
    en: { type: String, required: true },
    ar: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
