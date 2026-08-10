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
  },
  { timestamps: true }
);

productSchema.index({ featured: 1, order: 1 });

module.exports = mongoose.model('Product', productSchema);
