const express = require('express');
const router = express.Router();
const {
  getMySessions,
  getSession,
  joinSession,
  endSession,
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

router.get('/my-sessions', protect, getMySessions);
router.get('/:id', protect, getSession);
router.post('/:id/join', protect, joinSession);
router.post('/:id/end', protect, endSession);

module.exports = router;
