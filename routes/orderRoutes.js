const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderStats, paymobCallback } = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.post('/paymob-callback', paymobCallback);
router.get('/', protect, authorize('admin'), getOrders);
router.get('/stats/summary', protect, authorize('admin'), getOrderStats);

module.exports = router;
