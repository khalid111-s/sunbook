const express = require('express');
const router = express.Router();
const { logEvent, getClickStats } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', logEvent);
router.get('/stats/clicks', protect, authorize('admin'), getClickStats);

module.exports = router;
