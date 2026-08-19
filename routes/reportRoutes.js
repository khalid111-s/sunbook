const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getAvailableMonths, getMonthlyReportData } = require('../controllers/reportController');

router.get('/months', protect, authorize('admin'), getAvailableMonths);
router.get('/monthly/:year/:month', protect, authorize('admin'), getMonthlyReportData);

module.exports = router;
