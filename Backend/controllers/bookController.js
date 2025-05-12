// // controllers/bookController.js
// const Book = require("../models/bookModel");
// const Review = require("../models/ReviewModel");
// const mongoose = require("mongoose");
// const { uploadImage, uploadFile } = require("../utils/cloudinary");

// const createBook = async (req, res) => {
//   try {
//     const sellerId = req.user.id;
//     const {
//       title,
//       author,
//       description,
//       price,
//       stock,
//       category,
//       isbn,
//       isDigital,
//     } = req.body;

//     // Convert isDigital to boolean
//     const isDigitalBook = isDigital === "true" || isDigital === true;

//     // Validate required fields for all books
//     if (!title || !author || !price || !category || !isbn) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     let imageUrl = "https://via.placeholder.com/150"; // Default for physical books
//     let fileUrl = null;

//     if (isDigitalBook) {
//       // Digital book: require a file upload
//       if (!req.files || !req.files.file) {
//         return res.status(400).json({ error: "No digital file provided for digital book" });
//       }

//       const digitalFile = req.files.file[0];
//       fileUrl = await uploadFile(digitalFile.buffer, {
//         resource_type: "raw",
//         folder: "digital_books",
//       });
//     } else {
//       // Physical book: require stock and an image (optional, defaults to placeholder)
//       if (!stock || isNaN(stock) || parseInt(stock) < 0) {
//         return res.status(400).json({ error: "Stock is required for physical books and must be a non-negative number" });
//       }

//       if (req.files && req.files.image) {
//         const imageFile = req.files.image[0];
//         imageUrl = await uploadImage(imageFile.buffer);
//       }
//     }

//     const newBook = await Book.create({
//       title,
//       author,
//       description,
//       price: parseFloat(price),
//       stock: isDigitalBook ? null : parseInt(stock),
//       category,
//       imageUrl: isDigitalBook ? undefined : imageUrl,
//       seller: sellerId,
//       isbn,
//       isDigital: isDigitalBook,
//       fileUrl: isDigitalBook ? fileUrl : undefined,
//     });

//     return res.status(201).json({ success: true, data: newBook });
//   } catch (error) {
//     console.error("Error creating book:", error);
//     res.status(400).json({ error: error.message });
//   }
// };

// const updateBook = async (req, res) => {
//   const { id } = req.params;
//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ error: "Invalid book ID" });
//     }

//     const book = await Book.findById(id);
//     if (!book) {
//       return res.status(404).json({ msg: "Book not found" });
//     }

//     const {
//       title,
//       author,
//       description,
//       price,
//       stock,
//       category,
//       isbn,
//       isDigital,
//     } = req.body;

//     // Convert isDigital to boolean
//     const isDigitalBook = isDigital === "true" || isDigital === true;

//     let imageUrl = book.imageUrl;
//     let fileUrl = book.fileUrl;

//     if (isDigitalBook) {
//       if (req.files && req.files.file) {
//         const digitalFile = req.files.file[0];
//         fileUrl = await uploadFile(digitalFile.buffer, {
//           resource_type: "raw",
//           folder: "digital_books",
//         });
//       }
//     } else {
//       if (stock && (isNaN(stock) || parseInt(stock) < 0)) {
//         return res.status(400).json({ error: "Stock must be a non-negative number" });
//       }

//       if (req.files && req.files.image) {
//         const imageFile = req.files.image[0];
//         imageUrl = await uploadImage(imageFile.buffer);
//       }
//     }

//     const updatedBook = await Book.findByIdAndUpdate(
//       id,
//       {
//         title,
//         author,
//         description,
//         price: price ? parseFloat(price) : book.price,
//         stock: isDigitalBook ? null : (stock || book.stock),
//         category,
//         imageUrl: isDigitalBook ? undefined : imageUrl,
//         isbn,
//         isDigital: isDigitalBook,
//         fileUrl: isDigitalBook ? fileUrl : undefined,
//       },
//       { new: true, runValidators: true }
//     );

//     if (!updatedBook) {
//       return res.status(404).json({ msg: "Book not found" });
//     }

//     return res.status(200).json({ success: true, data: updatedBook });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// const getBook = async (req, res) => {
//   try {
//     const { search, category, minPrice, maxPrice, sort } = req.query;
//     let query = {};

//     // Search by title
//     if (search) {
//       query.title = { $regex: search, $options: "i" }; // Case-insensitive search
//     }

//     // Filter by category
//     if (category) {
//       query.category = category;
//     }

//     // Filter by price range
//     if (minPrice || maxPrice) {
//       query.price = {};
//       if (minPrice) query.price.$gte = Number(minPrice);
//       if (maxPrice) query.price.$lte = Number(maxPrice);
//     }

//     // Fetch books based on query
//     let books = await Book.find(query).sort({ createdAt: -1 });

//     books = await Promise.all(
//       books.map(async (book) => {
//         const reviews = await Review.find({ book: book._id })
//           .select("comment user rating")
//           .populate({
//             path: "user",
//             select: "name -_id",
//           });
//         return {
//           ...book.toObject(),
//           reviews,
//         };
//       })
//     );

//     // Sorting logic
//     if (sort === "price-asc") {
//       books = await Book.find(query).sort({ price: 1 });
//     } else if (sort === "price-desc") {
//       books = await Book.find(query).sort({ price: -1 });
//     }

//     res.status(200).json(books);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// const getSingleBook = async (req, res) => {
//   const { id } = req.params;
//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ error: "Invalid book ID" });
//     }

//     let book = await Book.findById(id);
//     if (!book) {
//       return res.status(404).json({ msg: "Book not found" });
//     }

//     const reviews = await Review.find({ book: book._id })
//       .select("comment user rating")
//       .populate({
//         path: "user",
//         select: "name -_id",
//       });

//     res.status(200).json({
//       success: true,
//       data: {
//         ...book.toObject(),
//         reviews,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const fetchMyBooks = async (req, res) => {
//   try {
//     const books = await Book.find({ seller: req.user.id });

//     if (!books || books.length === 0) {
//       return res.status(404).json({ message: "You have no books yet." });
//     }

//     const booksWithReviews = await Promise.all(
//       books.map(async (book) => {
//         const reviews = await Review.find({ book: book._id })
//           .select("comment user rating")
//           .populate({
//             path: "user",
//             select: "name -_id",
//           });

//         return {
//           ...book.toObject(),
//           reviews,
//         };
//       })
//     );

//     res.status(200).json({ success: true, data: booksWithReviews });
//   } catch (error) {
//     console.error("Error fetching seller's books:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// const deleteBook = async (req, res) => {
//   const { id } = req.params;
//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ error: "Invalid book ID" });
//     }
//     const deletedBook = await Book.findByIdAndDelete(id);
//     if (!deletedBook) {
//       return res.status(404).json({ msg: "Book not found" });
//     }
//     return res.status(200).json({ success: true, deletedData: deletedBook });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// module.exports = {
//   getBook,
//   getSingleBook,
//   fetchMyBooks,
//   createBook,
//   updateBook,
//   deleteBook,
// };








// controllers/bookController.js
const Book = require("../models/bookModel");
const Review = require("../models/ReviewModel");
const mongoose = require("mongoose");
const { uploadImage, uploadFile } = require("../utils/cloudinary");
const cloudinary = require("cloudinary").v2;

const createBook = async (req, res) => {
  try {
    const sellerId = req.user.id;
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

    const isDigitalBook = isDigital === "true" || isDigital === true;
    const isAudiobookBook = isAudiobook === "true" || isAudiobook === true;

    if (!title || !author || !price || !category || !isbn) {
      return res.status(400).json({ error: "Missing required fields" });
    }
     if (isDigitalBook && isAudiobookBook) {
      return res.status(400).json({ error: "A book cannot be both digital and audiobook" });
    }
    let imageUrl = "https://via.placeholder.com/150";
    let fileUrl = null;

     if (isDigitalBook || isAudiobookBook) {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: "No file provided for digital book or audiobook" });
      }    

      //  const digitalFile = req.files.file[0];
      // fileUrl = await uploadFile(digitalFile.buffer, {
      //   resource_type: "raw",
      //   folder: "digital_books",
      // });

      // if (req.files && req.files.image) {
      //   const imageFile = req.files.image[0];
      //   imageUrl = await uploadImage(imageFile.buffer);
      // }

       const file = req.files.file[0];
      fileUrl = await uploadFile(file.buffer, {
        resource_type: isAudiobookBook ? "video" : "raw", // Use 'video' for audio files
        folder: isAudiobookBook ? "audiobooks" : "digital_books",
      });

      if (req.files && req.files.image) {
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }

    } else {
      if (!stock || isNaN(stock) || parseInt(stock) < 0) {
        return res.status(400).json({ error: "Stock is required for physical books and must be a non-negative number" });
      }

      if (req.files && req.files.image) {
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }
    }

    const newBook = await Book.create({
      title,
      author,
      description,
      price: parseFloat(price),
      stock:  isDigitalBook || isAudiobookBook ? null : parseInt(stock),
      category,
      imageUrl,
      seller: sellerId,
      isbn,
      isDigital: isDigitalBook,
      isAudiobook: isAudiobookBook,
      fileUrl: isDigitalBook || isAudiobookBook ? fileUrl : undefined,
    });

    return res.status(201).json({ success: true, data: newBook });
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(400).json({ error: error.message });
  }
};

const updateBook = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ msg: "Book not found" });
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

    const isDigitalBook = isDigital === "true" || isDigital === true;
      const isAudiobookBook = isAudiobook === "true" || isAudiobook === true;

    if (isDigitalBook && isAudiobookBook) {
      return res.status(400).json({ error: "A book cannot be both digital and audiobook" });
    }

    let imageUrl = book.imageUrl;
    let fileUrl = book.fileUrl;

    // if (isDigitalBook) {
    //   if (req.files && req.files.file) {
    //     const digitalFile = req.files.file[0];
    //     fileUrl = await uploadFile(digitalFile.buffer, {
    //       resource_type: "raw",
    //       folder: "digital_books",
    //     });
    //   }
    //   if (req.files && req.files.image) {
    //     if (imageUrl && !imageUrl.includes("via.placeholder.com")) {
    //       const publicId = imageUrl.split("/").pop().split(".")[0];
    //       await cloudinary.uploader.destroy(`product_images/${publicId}`);
    //     }
    //     const imageFile = req.files.image[0];
    //     imageUrl = await uploadImage(imageFile.buffer);
    //   }

     if (isDigitalBook || isAudiobookBook) {
      if (req.files && req.files.file) {
        const file = req.files.file[0];
        fileUrl = await uploadFile(file.buffer, {
          resource_type: isAudiobookBook ? "video" : "raw",
          folder: isAudiobookBook ? "audiobooks" : "digital_books",
        });
      }
      if (req.files && req.files.image) {
        if (imageUrl && !imageUrl.includes("via.placeholder.com")) {
          const publicId = imageUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }

    } else {
      if (stock && (isNaN(stock) || parseInt(stock) < 0)) {
        return res.status(400).json({ error: "Stock must be a non-negative number" });
      }

      if (req.files && req.files.image) {
        if (imageUrl && !imageUrl.includes("via.placeholder.com")) {
          const publicId = imageUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }
    }

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      {
        title,
        author,
        description,
        price: price ? parseFloat(price) : book.price,
         stock: isDigitalBook || isAudiobookBook ? null : (stock || book.stock),
        category,
        imageUrl,
        isbn,
        isDigital: isDigitalBook,
        isAudiobook: isAudiobookBook,
        fileUrl: isDigitalBook || isAudiobookBook ? fileUrl : undefined,

      },
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

// Modified: Split into getDigitalBooks and getPhysicalBooks, and exclude fileUrl
const getDigitalBooks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    // let query = { isDigital: true }; // Only digital books
let query = { isDigital: true, isAudiobook: false };
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let books = await Book.find(query)
      .select("-fileUrl") // Exclude fileUrl
      .sort({ createdAt: -1 });

    books = await Promise.all(
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

    if (sort === "price-asc") {
      books = await Book.find(query).select("-fileUrl").sort({ price: 1 });
    } else if (sort === "price-desc") {
      books = await Book.find(query).select("-fileUrl").sort({ price: -1 });
    }

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPhysicalBooks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    let query = { isDigital: false }; // Only physical books

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let books = await Book.find(query)
      .select("-fileUrl") // Exclude fileUrl (though not applicable for physical books, for consistency)
      .sort({ createdAt: -1 });

    books = await Promise.all(
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

    if (sort === "price-asc") {
      books = await Book.find(query).select("-fileUrl").sort({ price: 1 });
    } else if (sort === "price-desc") {
      books = await Book.find(query).select("-fileUrl").sort({ price: -1 });
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

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let books = await Book.find(query)
      .select("-fileUrl")
      .sort({ createdAt: -1 });

    books = await Promise.all(
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

    if (sort === "price-asc") {
      books = await Book.find(query).select("-fileUrl").sort({ price: 1 });
    } else if (sort === "price-desc") {
      books = await Book.find(query).select("-fileUrl").sort({ price: -1 });
    }

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Modified: Exclude fileUrl from the response
const getSingleBook = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    let book = await Book.findById(id).select("-fileUrl"); // Exclude fileUrl
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
    const books = await Book.find({ seller: req.user.id }).select("-fileUrl"); // Exclude fileUrl

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

    res.status(200).json({ success: true, data: booksWithReviews });
  } catch (error) {
    console.error("Error fetching seller's books:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteBook = async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }
    const deletedBook = await Book.findByIdAndDelete(id);
    if (!deletedBook) {
      return res.status(404).json({ msg: "Book not found" });
    }
    return res.status(200).json({ success: true, deletedData: deletedBook });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getDigitalBooks, // New endpoint
  getPhysicalBooks, // New endpoint
  getSingleBook,
  fetchMyBooks,
  createBook,
  updateBook,
  deleteBook,
};