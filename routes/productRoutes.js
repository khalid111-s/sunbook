const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getProducts);

// لازم يفضل فوق route الـ '/:id' عشان express ميفهمش "reorder" على إنه :id
router.put('/reorder', protect, authorize('admin'), reorderProducts);

router.get('/:id', getProduct);

router.post('/', protect, authorize('admin'), createProduct);
router.put('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

module.exports = router;
