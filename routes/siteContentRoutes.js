const express = require('express');
const router = express.Router();
const { getSiteContent, updateSiteContent } = require('../controllers/siteContentController');
const { protect, authorize } = require('../middleware/auth');

// عام - كل زائر للموقع بيحتاج يجيب النصوص دي عشان محرك الترجمة يشتغل
router.get('/', getSiteContent);

// خاص بالأدمن بس - التعديل
router.put('/', protect, authorize('admin'), updateSiteContent);

module.exports = router;
