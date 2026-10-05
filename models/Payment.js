const mongoose = require('mongoose');

// سجل محاولة دفع واحدة عبر Geidea. ممكن تغطي طلب كتب و/أو حجز جلسة أو أكتر.
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    // المبلغ بيتحسب على السيرفر من الطلب/الحجز المحفوظين، مش من الفرونت
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    // المرجع اللي بنبعته لـ Geidea ونرجع نسأل بيه
    merchantReferenceId: { type: String, required: true, unique: true },
    sessionId: { type: String, default: '' },
    geideaOrderId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
