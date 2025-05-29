const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    author: {
      type: String,
      required: [true, "Please add an author"],
      trim: true,
      maxlength: [50, "Author name cannot be more than 50 characters"],
    },
    description: {
      type: String,
      required: false,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      min: [0, "Price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [
        function () {
          return !this.isDigital && !this.isAudiobook;
        },
        "Stock is required for physical books",
      ],
      min: [0, "Stock cannot be negative"],
      default: null,
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      enum: [
        "Fiction",
        "Mystery",
        "Romance",
        "Science Fiction",
        "Fantasy",
        "Horror",
        "Thriller",
        "Historical Fiction",
        "Biography",
        "Self-Help",
        "Business",
        "Science",
        "Philosophy",
        "Poetry",
        "Children",
        "Young Adult",
        "Travel",
        "Cooking",
        "Art",
        "History",
        "Other",
      ],
    },
    imageUrl: {
      type: String,
      default: "https://via.placeholder.com/150",
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookShop",
      required: true,
    },
    isbn: {
      type: String,
      required: [true, "Please add an ISBN"],
      unique: true,
      match: [/^(?:\d{10}|\d{13})$/, "ISBN must be 10 or 13 digits"],
    },
    isDigital: {
      type: Boolean,
      default: false,
    },
    isAudiobook: {
      type: Boolean,
      default: false,
    },
    fileUrl: {
      type: String,
      required: [
        function () {
          return this.isDigital || this.isAudiobook;
        },
        "File URL is required for digital books or audiobooks",
      ],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
    },
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Middleware to update BookShop's availableBooks array
bookSchema.post('save', async function () {
  const BookShop = mongoose.model('BookShop');
  await BookShop.findByIdAndUpdate(
    this.shop,
    { $addToSet: { availableBooks: this._id } }
  );
});

// Middleware to remove book from BookShop's availableBooks array when deleted
bookSchema.post('remove', async function () {
  const BookShop = mongoose.model('BookShop');
  await BookShop.findByIdAndUpdate(
    this.shop,
    { $pull: { availableBooks: this._id } }
  );
});

module.exports = mongoose.model("Book", bookSchema);