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
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    governorate: { type: String, default: '' },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    // العملة اللي اتدفع بيها الطلب فعليًا (بتتحدد حسب بلد الزائر وقت الشراء)
    currency: { type: String, enum: ['EGP', 'EUR'], default: 'EGP' },
    // لو الطلب كان باليورو، ده المبلغ الفعلي بالجنيه اللي اتحصّل عن طريق Paymob
    // بعد التحويل بسعر الصرف وقت الطلب (Paymob بيتعامل بالجنيه بس على حسابنا الحالي)
    chargedAmountEGP: { type: Number, default: null },
    // ملحوظة: دلوقتي مفيش بوابة دفع حقيقية موصولة على شراء الكتب،
    // فكل الطلبات بتتسجل بحالة "pending" لحد ما يتوصل Paymob فعليًا.
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    paymobOrderId: { type: String },
    paymobPaymentKey: { type: String },
    // مرجع عملية الدفع عند PayTabs - بنستخدمه لمطابقة الـ webhook بالطلب ده
    paytabsTranRef: { type: String },
    // بلد الطلب - بيتاخد تلقائيًا من هيدر Vercel وقت إنشاء الطلب
    country: { type: String, default: 'Unknown' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
