const Review = require('../models/Review');

// GET /api/reviews/:productId - عام، أي حد يشوف المراجعات من غير تسجيل دخول
const getProductReviews = async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).sort({ createdAt: -1 });

  const count = reviews.length;
  const average = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  res.json({
    success: true,
    count,
    averageRating: Math.round(average * 10) / 10,
    data: reviews,
  });
};

// POST /api/reviews/:productId - محمي، لازم تسجيل دخول
// لو اليوزر عنده مراجعة قديمة على نفس الكتاب، بنعدلها بدل ما نعمل واحدة جديدة
const addOrUpdateReview = async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  if (!comment || !comment.trim()) {
    res.status(400);
    throw new Error('Comment is required');
  }

  const review = await Review.findOneAndUpdate(
    { product: req.params.productId, user: req.user._id },
    {
      product: req.params.productId,
      user: req.user._id,
      userName: req.user.name,
      rating,
      comment: comment.trim(),
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ success: true, data: review });
};

// DELETE /api/reviews/:id - محمي، اليوزر يقدر يمسح مراجعته هو بس (أو الأدمن يمسح أي مراجعة)
const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  const isOwner = review.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error('You are not allowed to delete this review');
  }

  await review.deleteOne();

  res.json({ success: true, message: 'Review deleted' });
};

module.exports = { getProductReviews, addOrUpdateReview, deleteReview };
