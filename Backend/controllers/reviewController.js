const Review = require("../models/ReviewModel");
const Book = require("../models/bookModel");
const mongoose = require('mongoose')
// Create a review and update book's average rating
const createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { bookId}  = req.params
    const userId = req.user._id;
   
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid Book ID format" });
    }

    // 1️⃣ Find the book
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // 2️⃣ Check if the user already reviewed
    const alreadyReviewed = await Review.findOne({ book: bookId, user: userId });
    if (alreadyReviewed) {
      return res.status(400).json({ message: "You have already reviewed this book" });
    }

    // 3️⃣ Create and save the review
    const review = new Review({
      book: bookId,
      user: userId,
      rating,
      comment,
    });

    await review.save();

    // 4️⃣ Update book's numReviews and averageRating
    const reviews = await Review.find({ book: bookId });
    const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Update only the rating-related fields
    await Book.findByIdAndUpdate(bookId, {
      numReviews: reviews.length,
      averageRating: averageRating
    });

    res.status(201).json({ message: "Review added successfully", review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get all reviews for a book
const getReviewsForBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const reviews = await Review.find({ book: bookId })
      .select('user book rating comment createdAt')  // Explicitly select all fields
      .populate("user", "name")
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a review (only by the reviewer)
const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { reviewId } = req.params;

    // 1️⃣ Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // 2️⃣ Check if user is the owner of the review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 3️⃣ Create update object with only changed fields
    const updateData = {};

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      if (rating !== review.rating) {
        updateData.rating = rating;
      }
    }

    if (comment !== undefined && comment !== review.comment) {
      updateData.comment = comment;
    }

    // If no fields were updated
    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No changes detected",
        review 
      });
    }

    // 4️⃣ Update review
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      updateData,
      { new: true, runValidators: true }
    );

    // 5️⃣ Recalculate book's average rating
    const reviews = await Review.find({ book: review.book });
    const book = await Book.findById(review.book);

    book.averageRating =
      reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;

    await book.save();

    res.status(200).json({ 
      success: true,
      message: "Review updated successfully", 
      review: updatedReview 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Delete a review (only by the reviewer)
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    // 1️⃣ Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // 2️⃣ Check if user is the owner of the review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 3️⃣ Delete the review
    await review.deleteOne();

    // 4️⃣ Update book's numReviews and averageRating
    const reviews = await Review.find({ book: review.book });
    const book = await Book.findById(review.book);

    book.numReviews = reviews.length;
    book.averageRating =
      reviews.length > 0
        ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
        : 0;

    await book.save();

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = { createReview, getReviewsForBook, updateReview, deleteReview };
