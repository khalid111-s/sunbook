const express = require('express');
const router = express.Router();
const {
  createOrder,
  cancelOrder,
  getOrders,
  getMyOrders,
  updateOrderFulfillment,
  getOrderById,
  getOrderStats,
  fawaterakPaidWebhook,
  fawaterakFailedWebhook,
  fawaterakCancelWebhook,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createOrder);
// فواتيرك (Fawaterak) webhooks - سجّل الروابط دي في لوحة تحكم فواتيرك تحت Integrations
router.post('/fawaterak-webhook/paid', fawaterakPaidWebhook);
router.post('/fawaterak-webhook/failed', fawaterakFailedWebhook);
router.post('/fawaterak-webhook/cancel', fawaterakCancelWebhook);
router.get('/', protect, authorize('admin'), getOrders);
router.get('/my-orders', protect, getMyOrders);
router.get('/stats/summary', protect, authorize('admin'), getOrderStats);
router.patch('/:id/fulfillment', protect, authorize('admin'), updateOrderFulfillment);
router.patch('/:id/cancel', protect, cancelOrder);
router.get('/:id', protect, getOrderById);

module.exports = router;
