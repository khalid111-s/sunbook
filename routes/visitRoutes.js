const express = require('express');
const router = express.Router();
const { logVisit, heartbeat, getOnlineCount, getVisitStats } = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', logVisit);
router.post('/heartbeat', heartbeat);
router.get('/online', protect, authorize('admin'), getOnlineCount);
router.get('/stats', protect, authorize('admin'), getVisitStats);

module.exports = router;
