const Product = require('../models/Product');

// @desc    Get all products (optionally only featured)
// @route   GET /api/products?featured=true
// @access  Public
const getProducts = async (req, res) => {
  const filter = {};
  if (req.query.featured === 'true') filter.featured = true;

  const products = await Product.find(filter).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, count: products.length, data: products });
};

// @desc    Get a single product by id
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ success: true, data: product });
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  const { title, price, priceEUR, image, description, descriptionAr, type, badges, featured, order, featuredOrder, showInAllProducts, inStock, egyptOnly, trackStock, stockCount, cardImage } = req.body;

  const product = await Product.create({
    title,
    price,
    priceEUR: priceEUR || null,
    image,
    description,
    descriptionAr,
    type,
    badges,
    featured,
    order,
    featuredOrder,
    showInAllProducts,
    inStock,
    egyptOnly,
    trackStock,
    stockCount: trackStock ? Number(stockCount) || 0 : 0,
    cardImage: {
      width: Number(cardImage?.width) || 260,
      height: Number(cardImage?.height) || 300,
      offsetY: Number(cardImage?.offsetY) || 0,
      mobileWidth: Number(cardImage?.mobileWidth) || 135,
      mobileHeight: Number(cardImage?.mobileHeight) || 160,
      mobileOffsetY: Number(cardImage?.mobileOffsetY) || 0,
    },
  });

  res.status(201).json({ success: true, data: product });
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  const { title, price, priceEUR, image, description, descriptionAr, type, badges, featured, order, featuredOrder, showInAllProducts, inStock, egyptOnly, trackStock, stockCount, cardImage } = req.body;

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      title,
      price,
      priceEUR: priceEUR || null,
      image,
      description,
      descriptionAr,
      type,
      badges,
      featured,
      order,
      featuredOrder,
      showInAllProducts,
      inStock,
      egyptOnly,
      trackStock,
      stockCount: trackStock ? Number(stockCount) || 0 : 0,
      cardImage: {
        width: Number(cardImage?.width) || 260,
        height: Number(cardImage?.height) || 300,
        offsetY: Number(cardImage?.offsetY) || 0,
        mobileWidth: Number(cardImage?.mobileWidth) || 135,
        mobileHeight: Number(cardImage?.mobileHeight) || 160,
        mobileOffsetY: Number(cardImage?.mobileOffsetY) || 0,
      },
    },
    { new: true, runValidators: true }
  );

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ success: true, data: product });
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ success: true, data: {} });
};

// @desc    Bulk-update display order for a list of products in one go
//          field: 'order' (All Products list) or 'featuredOrder' (Best Offers list) -
//          the two are independent, so reordering one never touches the other.
// @route   PUT /api/products/reorder
// @access  Private/Admin
// body: { field: 'order' | 'featuredOrder', items: [{ id, value }, ...] }
const reorderProducts = async (req, res) => {
  const { field, items } = req.body;

  if (!['order', 'featuredOrder'].includes(field) || !Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error('Invalid reorder payload');
  }

  const ops = items
    .filter((it) => it && it.id)
    .map((it) => ({
      updateOne: {
        filter: { _id: it.id },
        update: { $set: { [field]: Number(it.value) || 0 } },
      },
    }));

  if (ops.length) await Product.bulkWrite(ops);

  res.json({ success: true });
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, reorderProducts };
