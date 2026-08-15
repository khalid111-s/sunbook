const mongoose = require('mongoose');

// أكواد خصم بتتولّد من لوحة الأدمن بمدة صلاحية محددة (كام ساعة/يوم/أسبوع/شهر/سنة)
const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    // تاريخ انتهاء الصلاحية - بيتحسب وقت الإنشاء بناءً على المدة اللي اختارها الأدمن
    expiresAt: {
      type: Date,
      required: true,
    },
    // أقصى عدد مرات استخدام (اختياري - لو فاضي يبقى غير محدود)
    usageLimit: {
      type: Number,
      default: null,
    },
    timesUsed: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

promoCodeSchema.index({ code: 1 });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
