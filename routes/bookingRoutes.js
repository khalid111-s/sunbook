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
  fawaterakPaidWebhook,
  fawaterakFailedWebhook,
  fawaterakCancelWebhook,
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
router.post('/fawaterak-webhook/paid', fawaterakPaidWebhook);
router.post('/fawaterak-webhook/failed', fawaterakFailedWebhook);
router.post('/fawaterak-webhook/cancel', fawaterakCancelWebhook);

module.exports = router;
