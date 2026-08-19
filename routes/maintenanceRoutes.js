const express = require('express');
const router = express.Router();
const { wipeData } = require('../controllers/maintenanceController');

router.post('/wipe-data', wipeData);

module.exports = router;
