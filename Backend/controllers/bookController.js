const Book = require("../models/bookModel");
const Review = require("../models/ReviewModel")
const mongoose = require("mongoose");
const { uploadImage } = require("../utils/cloudinary");
const fs = require("fs");



const createBook = async (req, res) => {
  const sellerId = req.user.id;
  const {
    title,
    author,
    description,
    price,
    stock,
    category,
    imageUrl,
    seller,
    isbn,
  } = req.body;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const imageUrl = await uploadImage(req.file.buffer);
    // Delete the local file after uploading to Cloudinary

    const newBook = await Book.create({
      title,
      author,
      description,
      price,
      stock,
      category,
      imageUrl,
      seller: sellerId,
      isbn,
    });
    return res.status(200).json({ success: true, data: newBook });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getBook = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    let query = {};

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" }; // Case-insensitive search
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Fetch books based on query
    let books = await Book.find(query).sort({ createdAt: -1 });

    books = await Promise.all(
      books.map(async (book) => {
        const reviews = await Review.find({ book: book._id })
        .select('comment user rating')
        .populate({
          path: 'user',
          select: 'name -_id', // Select only the name and exclude _id
        });
        return {
          ...book.toObject(),
          reviews, // Attach reviews to the book object
        };
      })
    );
    
    // Sorting logic
    if (sort === "price-asc") {
      books = await Book.find(query).sort({ price: 1 });
    } else if (sort === "price-desc") {
      books = await Book.find(query).sort({ price: -1 });
    }

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSingleBook = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    // Find the book by ID
    let book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({ msg: "Book not found" });
    }

    // Fetch reviews separately
    const reviews = await Review.find({ book: book._id })
      .select('comment user rating')
      .populate({
        path: 'user',
        select: 'name -_id', // Select only the name and exclude _id
      });

    // Return the book with the reviews
    res.status(200).json({
      success: true,
      data: {
        ...book.toObject(),
        reviews,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


//fetch books created by me
const fetchMyBooks = async (req, res) => {
  try {
    // Fetch books owned by the seller
    const books = await Book.find({ seller: req.user.id });

    if (!books || books.length === 0) {
      return res.status(404).json({ message: "You have no books yet." });
    }

    // Fetch reviews for each book
    const booksWithReviews = await Promise.all(
      books.map(async (book) => {
        const reviews = await Review.find({ book: book._id })
          .select('comment user rating')
          .populate({
            path: 'user',
            select: 'name -_id', // Select only the name and exclude _id
          });

        return {
          ...book.toObject(),
          reviews, // Attach reviews to the book object
        };
      })
    );

    // Return books with reviews
    res.status(200).json({ success: true, data: booksWithReviews });

  } catch (error) {
    console.error("Error fetching seller's books:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const updateBook = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedBook) {
      return res.status(404).json({ msg: "Book not found" });
    }

    return res.status(200).json({ success: true, data: updatedBook });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteBook = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }
    const deletedBook = await Book.findByIdAndDelete(req.params.id);
    if (!deletedBook) {
      return res.status(404).json({ msg: "Book not found" });
    }
    return res.status(200).json({ sucess: true, deletedData: deletedBook });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getBook,
  getSingleBook,
  fetchMyBooks,
  createBook,
  updateBook,
  deleteBook,
};
