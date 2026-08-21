const express = require('express');
const router = express.Router();
const {
  getProductReviews,
  addOrUpdateReview,
  deleteReview,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.get('/:productId', getProductReviews);
router.post('/:productId', protect, addOrUpdateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
