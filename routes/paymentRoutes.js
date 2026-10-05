const express = require('express');
const router = express.Router();
const { createPaymentSession, confirmPayment, handleCallback } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/session', protect, createPaymentSession);
router.post('/callback', handleCallback);
router.post('/:id/confirm', protect, confirmPayment);

module.exports = router;
