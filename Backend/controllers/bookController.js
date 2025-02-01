const Book = require("../models/bookModel");
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

    // Sorting logic
    if (sort === "price-asc") {
      books.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      books.sort((a, b) => b.price - a.price);
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
    const singleBook = await Book.findById(id);
    if (!singleBook) {
      return res.status(404).json({ msg: "Book not found" });
    }
    return res.status(200).json({ success: true, data: singleBook });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//fetch books created by me
const fetchMyBooks = async (req, res) => {
 
    try {
      const products = await Book.find({ seller: req.user.id }); // Fetch products owned by the seller
  
      if (!products || products.length === 0) {
        return res.status(404).json({ message: "You have no books yet." });
      }
  
      res.status(200).json(products);
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
