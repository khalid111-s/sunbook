const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('admin'), uploadImage);

module.exports = router;
