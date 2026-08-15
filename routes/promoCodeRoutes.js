const express = require('express');
const router = express.Router();
const {
  createPromoCode,
  getPromoCodes,
  deactivatePromoCode,
  deletePromoCode,
  validatePromoCode,
} = require('../controllers/promoCodeController');
const { protect, authorize } = require('../middleware/auth');

router.post('/validate', validatePromoCode);

router.get('/', protect, authorize('admin'), getPromoCodes);
router.post('/', protect, authorize('admin'), createPromoCode);
router.patch('/:id/deactivate', protect, authorize('admin'), deactivatePromoCode);
router.delete('/:id', protect, authorize('admin'), deletePromoCode);

module.exports = router;
