const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  getOrderStats,
  paymobCallback,
  paytabsCallback,
  paytabsReturnRedirect,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.post('/paymob-callback', paymobCallback);
router.post('/paytabs-callback', paytabsCallback);
router.all('/paytabs-return', paytabsReturnRedirect);
router.get('/', protect, authorize('admin'), getOrders);
router.get('/stats/summary', protect, authorize('admin'), getOrderStats);
router.get('/:id', protect, getOrderById);

module.exports = router;
