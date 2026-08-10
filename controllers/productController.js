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
  const { title, price, image, description, type, badges, featured, order, inStock } = req.body;

  const product = await Product.create({
    title,
    price,
    image,
    description,
    type,
    badges,
    featured,
    order,
    inStock,
  });

  res.status(201).json({ success: true, data: product });
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  const { title, price, image, description, type, badges, featured, order, inStock } = req.body;

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { title, price, image, description, type, badges, featured, order, inStock },
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

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
