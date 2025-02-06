const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reviewer
  book: { type: mongoose.Schema.Types.ObjectId, ref: "bookModel", required: true }, // Book being reviewed
  rating: { type: Number, required: true, min: 1, max: 5 }, // Rating (1-5 stars)
  comment: { type: String, maxlength: 500 }, // Optional comment
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Review", reviewSchema);