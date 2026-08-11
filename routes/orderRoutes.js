const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderStats } = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.get('/', protect, authorize('admin'), getOrders);
router.get('/stats/summary', protect, authorize('admin'), getOrderStats);

module.exports = router;
