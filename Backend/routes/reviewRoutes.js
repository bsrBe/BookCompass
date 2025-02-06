const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
  createReview,
  getReviewsForBook,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

// Create a review for a book
router.post("/:bookId/reviews", protect, createReview);

// Get all reviews for a book
router.get("/:bookId/reviews", getReviewsForBook);

// Update a review (only by the reviewer)
router.put("/:bookId/reviews/:reviewId", protect, updateReview);

// Delete a review (only by the reviewer)
router.delete("/:bookId/reviews/:reviewId", protect, deleteReview);

module.exports = router;
