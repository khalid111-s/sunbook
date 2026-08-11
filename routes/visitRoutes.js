const express = require('express');
const router = express.Router();
const { logVisit, getVisitStats } = require('../controllers/visitController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', logVisit);
router.get('/stats', protect, authorize('admin'), getVisitStats);

module.exports = router;
