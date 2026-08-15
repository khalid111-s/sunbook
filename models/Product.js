const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    // سعر اختياري باليورو - بيظهر تلقائي للزوار من برة مصر بدل السعر بالجنيه
    priceEUR: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: null,
    },
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['physical', 'digital'],
      default: 'physical',
    },
    // Small labels shown on the product card, e.g. ['Paperback', 'English']
    badges: {
      type: [String],
      default: [],
    },
    // Featured products show up in the "Best Offers" section on the homepage
    featured: {
      type: Boolean,
      default: false,
    },
    // Controls display order (lower shows first)
    order: {
      type: Number,
      default: 0,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    // لو true، بيظهر بادج "Available in Egypt only" على كارت المنتج وصفحته
    egyptOnly: {
      type: Boolean,
      default: false,
    },
    // مخزون فعلي للكتب الفيزيكال - لو trackStock مفعّل، الموقع بيعتمد على stockCount
    // لتحديد التوافر تلقائيًا (وبينقص لوحده مع كل طلب) بدل الاعتماد على inStock اليدوي بس
    trackStock: {
      type: Boolean,
      default: false,
    },
    stockCount: {
      type: Number,
      default: 0,
      min: [0, 'Stock count cannot be negative'],
    },
  },
  { timestamps: true }
);

productSchema.index({ featured: 1, order: 1 });

module.exports = mongoose.model('Product', productSchema);
