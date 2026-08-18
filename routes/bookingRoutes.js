const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getMyBookings,
  getAvailability,
  getMonthAvailability,
  cancelBooking,
  rescheduleBooking,
  sendUpcomingReminders,
  paytabsCallback,
  paytabsReturnRedirect,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/', protect, authorize('admin'), getAllBookings);
router.get('/my-bookings', protect, getMyBookings);
router.get('/availability', getAvailability);
router.get('/availability-month', getMonthAvailability);
router.get('/send-reminders', sendUpcomingReminders);
router.patch('/:id/cancel', protect, cancelBooking);
router.patch('/:id/reschedule', protect, rescheduleBooking);
router.post('/paytabs-callback', paytabsCallback);
router.all('/paytabs-return', paytabsReturnRedirect);

module.exports = router;
