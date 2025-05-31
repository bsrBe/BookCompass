// controllers/bookController.js
const Book = require("../models/bookModel");
const Review = require("../models/ReviewModel");
const BookShop = require("../models/bookShopModel");
const mongoose = require("mongoose");
const { uploadImage, uploadFile } = require("../utils/cloudinary");

const getDigitalBooks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    let query = { isDigital: true };

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
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
    let books = await Book.find(query);

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

const getPhysicalBooks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    let query = { isDigital: false, isAudiobook: false };

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
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
    let books = await Book.find(query);

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

const getAudiobooks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    let query = { isAudiobook: true };

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
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
    let books = await Book.find(query);

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

    let book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ msg: "Book not found" });
    }

    const reviews = await Review.find({ book: book._id })
      .select("comment user rating")
      .populate({
        path: "user",
        select: "name -_id",
      });

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

const fetchMyBooks = async (req, res) => {
  try {
    const books = await Book.find({ seller: req.user.id });

    if (!books || books.length === 0) {
      return res.status(404).json({ message: "You have no books yet." });
    }

    const booksWithReviews = await Promise.all(
      books.map(async (book) => {
        const reviews = await Review.find({ book: book._id })
          .select("comment user rating")
          .populate({
            path: "user",
            select: "name -_id",
          });
        return {
          ...book.toObject(),
          reviews,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: booksWithReviews,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createBook = async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Fetch the seller's bookshop
    const bookShop = await BookShop.findOne({ seller: sellerId });
    if (!bookShop) {
      return res.status(400).json({ 
        error: "You need to create a bookshop before adding books. Please create a bookshop first." 
      });
    }

    const {
      title,
      author,
      description,
      price,
      stock,
      category,
      isbn,
      isDigital,
      isAudiobook,
    } = req.body;

    // Convert isDigital and isAudiobook to boolean
    const isDigitalBook = isDigital === "true" || isDigital === true;
    const isAudiobookBook = isAudiobook === "true" || isAudiobook === true;

    // Validate required fields for all books
    if (!title || !author || !price || !category || !isbn) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let imageUrl = "https://via.placeholder.com/150"; // Default placeholder
    let fileUrl = null;

    // Handle image upload for all book types if provided
    if (req.files && req.files.image) {
      const imageFile = req.files.image[0];
      try {
        imageUrl = await uploadImage(imageFile.buffer, "book_images");
        console.log("Uploaded image URL:", imageUrl); // Debug log
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(400).json({ error: "Failed to upload image" });
      }
    }

    if (isDigitalBook || isAudiobookBook) {
      // Digital book or audiobook: require a file upload
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: "No digital file provided for digital book or audiobook" });
      }

      const digitalFile = req.files.file[0];
      fileUrl = await uploadFile(digitalFile.buffer, {
        resource_type: "raw",
        folder: isAudiobookBook ? "audiobooks" : "digital_books",
      });
    } else {
      // Physical book: require stock
      if (!stock || isNaN(stock) || parseInt(stock) < 0) {
        return res.status(400).json({ error: "Stock is required for physical books and must be a non-negative number" });
      }
    }

    const newBook = await Book.create({
      title,
      author,
      description,
      price: parseFloat(price),
      stock: isDigitalBook || isAudiobookBook ? null : parseInt(stock),
      category,
      imageUrl,
      seller: sellerId,
      shop: bookShop._id,
      isbn,
      isDigital: isDigitalBook,
      isAudiobook: isAudiobookBook,
      fileUrl: isDigitalBook || isAudiobookBook ? fileUrl : undefined,
    });

    // Return the complete book data including the actual imageUrl
    return res.status(201).json({ 
      success: true, 
      data: {
        ...newBook.toObject(),
        imageUrl: imageUrl // Ensure we return the actual uploaded image URL
      }
    });
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(400).json({ error: error.message });
  }
};

const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Check if user is the seller of the book
    if (book.seller.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this book" });
    }

    // Get existing book data
    const existingData = book.toObject();
    
    // Create update object with only changed fields
    const updateData = {};
    
    // Handle text fields - only update if provided and not empty
    const textFields = ['title', 'author', 'description', 'category', 'isbn'];
    textFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== '' && req.body[field] !== existingData[field]) {
        updateData[field] = req.body[field];
      }
    });

    // Handle numeric fields - only update if provided and valid
    if (req.body.price !== undefined && req.body.price !== '') {
      const newPrice = parseFloat(req.body.price);
      if (!isNaN(newPrice) && newPrice !== existingData.price) {
        if (newPrice < 0) {
          return res.status(400).json({ error: "Price cannot be negative" });
        }
        updateData.price = newPrice;
      }
    }
    
    if (req.body.stock !== undefined && req.body.stock !== '') {
      const newStock = parseInt(req.body.stock);
      if (!isNaN(newStock) && newStock !== existingData.stock) {
        if (newStock < 0) {
          return res.status(400).json({ error: "Stock must be a non-negative number" });
        }
        updateData.stock = newStock;
      }
    }

    // Handle boolean fields - only update if provided
    if (req.body.isDigital !== undefined && req.body.isDigital !== '') {
      const isDigital = req.body.isDigital === "true" || req.body.isDigital === true;
      if (isDigital !== existingData.isDigital) {
        updateData.isDigital = isDigital;
      }
    }
    
    if (req.body.isAudiobook !== undefined && req.body.isAudiobook !== '') {
      const isAudiobook = req.body.isAudiobook === "true" || req.body.isAudiobook === true;
      if (isAudiobook !== existingData.isAudiobook) {
        updateData.isAudiobook = isAudiobook;
      }
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.image) {
        // Delete old image if exists
        if (existingData.imageUrl && !existingData.imageUrl.includes("via.placeholder.com")) {
          const publicId = existingData.imageUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }
        const imageFile = req.files.image[0];
        updateData.imageUrl = await uploadImage(imageFile.buffer);
      }

      if (req.files.file && (updateData.isDigital || updateData.isAudiobook)) {
        const file = req.files.file[0];
        updateData.fileUrl = await uploadFile(file.buffer, {
          resource_type: updateData.isAudiobook ? "video" : "raw",
          folder: updateData.isAudiobook ? "audiobooks" : "digital_books",
        });
      }
    }

    // If no fields were updated
    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No changes detected",
        data: book 
      });
    }

    // Update the book
    const updatedBook = await Book.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({ 
      success: true, 
      message: "Book updated successfully",
      data: updatedBook 
    });
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

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ msg: "Book not found" });
    }

    // Check if the book belongs to the seller
    if (book.seller.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to delete this book" });
    }

    await Book.findByIdAndDelete(id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMostSoldBooks = async (req, res) => {
  try {
    const books = await Book.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "items.book",
          as: "orders"
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          author: 1,
          price: 1,
          isDigital: 1,
          isAudiobook: 1,
          totalSold: { $size: "$orders" }
        }
      },
      {
        $sort: { totalSold: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllBooks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    let query = {};

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
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
    let books = await Book.find(query).select('-fileUrl');

    // Sorting logic
    if (sort === "price-asc") {
      books.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      books.sort((a, b) => b.price - a.price);
    } else if (sort === "newest") {
      books.sort((a, b) => b.createdAt - a.createdAt);
    }

    res.status(200).json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

module.exports = {
  getDigitalBooks,
  getPhysicalBooks,
  getSingleBook,
  fetchMyBooks,
  createBook,
  updateBook,
  getAudiobooks,
  deleteBook,
  getMostSoldBooks,
  getAllBooks,
};
