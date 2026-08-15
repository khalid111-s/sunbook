const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getMyBookings,
  cancelBooking,
  paymobCallback,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/', protect, authorize('admin'), getAllBookings);
router.get('/my-bookings', protect, getMyBookings);
router.patch('/:id/cancel', protect, cancelBooking);
router.post('/paymob-callback', paymobCallback);

module.exports = router;
