const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, default: 1 },
  category: {
    type: String,
    required: true,
    enum: [
      "Fiction",
      "Non-Fiction",
      "Science",
      "History",
      "Biography",
      "Other",
    ],
  },
  imageUrl: {
    type: String,
    default: "https://via.placeholder.com/150",
  },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isbn: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  }
},
{timestamps : true}
);

module.exports = mongoose.model("bookModel" , bookSchema)