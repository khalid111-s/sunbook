const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, default: 1 },
    type: { type: String, enum: ['physical', 'digital'], default: 'physical' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    governorate: { type: String, default: '' },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    // كود الخصم اللي اتستخدم في الطلب ده (لو فيه) + قيمة الخصم اللي اتطرحت بالفعل
    promoCode: { type: String, default: '' },
    discountAmount: { type: Number, default: 0 },
    // العملة اللي اتدفع بيها الطلب فعليًا (بتتحدد حسب بلد الزائر وقت الشراء)
    currency: { type: String, enum: ['EGP', 'EUR'], default: 'EGP' },
    // legacy: كان بيتسجل هنا المبلغ بالجنيه بعد التحويل وقت استخدام Paymob (مبقاش مستخدم مع Kashier
    // لأنه بيقبل EGP/USD/GBP/EUR مباشرة من غير أي تحويل يدوي). سايبينه عشان الطلبات القديمة.
    chargedAmountEGP: { type: Number, default: null },
    // بنمنع بيه إرسال إيميل التأكيد أكتر من مرة (ممكن الطلب يترفع "paid" من أكتر مصدر - webhook أو فحص مباشر)
    confirmationEmailSent: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    // حالة تجهيز/شحن الطلب - منفصلة عن حالة الدفع، بيحدّثها الأدمن يدويًا والعميل يشوفها في البروفايل
    fulfillmentStatus: {
      type: String,
      enum: ['processing', 'shipped', 'delivered'],
      default: 'processing',
    },
    // intent_key بتاع فواتيرك (Fawaterak) - بيوصلنا وقت إنشاء رابط الدفع، ومحتاجينه نربط بيه الـ webhooks والاسترجاع
    fawaterakIntentKey: { type: String },
    // transaction_id الرقمي بتاع فواتيرك - بيوصلنا من الـ webhook بعد الدفع، ومحتاجينه للاسترجاع (refund)
    fawaterakTransactionId: { type: String },
    // بلد الطلب - بيتاخد تلقائيًا من هيدر Vercel وقت إنشاء الطلب
    country: { type: String, default: 'Unknown' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
