
// const axios = require("axios");
// const Order = require("../models/orderModel");
// const cloudinary = require("cloudinary").v2;

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_SECRET_KEY,
//   secure: true,
// });

// const streamDigitalBook = async (req, res) => {
//   try {
//     const { bookId } = req.params;
//     const userId = req.user.id;

//     const order = await Order.findOne({
//       user: userId,
//       "items.book": bookId,
//       paymentStatus: "paid",
//     }).populate("items.book");

//     if (!order) {
//       return res.status(403).json({ message: "You don’t have access to this book" });
//     }

//     const book = order.items.find((item) => item.book._id.toString() === bookId)?.book;
//     if (!book || !book.isDigital) {
//       return res.status(404).json({ message: "Digital book not found" });
//     }

//     const fileUrl = book.fileUrl;
//     const response = await axios.get(fileUrl, { responseType: "stream" });

//     res.setHeader("Content-Type", "application/pdf");
//     // res.setHeader(
//     //   "Content-Disposition",
//     //   download
//     //     ? `attachment; filename="${filename}"`
//     //     : `inline; filename="${filename}"`
//     // );
//     res.setHeader("Content-Type", response.headers["content-type"]);
//     res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
//     res.setHeader("Pragma", "no-cache");
//     res.setHeader("Expires", "0");
//     res.setHeader("Content-Disposition", "inline");

//     response.data.pipe(res);
//   } catch (error) {
//     console.error("Error streaming digital book:", error);
//     res.status(500).json({ error: "Error streaming content" });
//   }
// };

// module.exports = { streamDigitalBook };



const axios = require("axios");
const Order = require("../models/orderModel");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
});

// const streamDigitalBook = async (req, res) => {

//   try {
//     const { bookId } = req.params;
//     const userId = req.user.id;

//     const order = await Order.findOne({
//       user: userId,
//       "items.book": bookId,
//       paymentStatus: "paid",
//     }).populate("items.book");

//     if (!order) {
//       return res.status(403).json({ message: "You don't have access to this book" });
//     }

//     const book = order.items.find((item) => item.book._id.toString() === bookId)?.book;
//     if (!book || !book.isDigital) {
//       return res.status(404).json({ message: "Digital book not found" });
//     }

//     const fileUrl = book.fileUrl;
//     const response = await axios.get(fileUrl, { responseType: "stream" });

//     // Set headers before piping
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
//     res.setHeader("Pragma", "no-cache");
//     res.setHeader("Expires", "0");
//     res.setHeader("Content-Disposition", `inline; filename="${book.title || 'book'}.pdf"`);

//     // Pipe the response
//     response.data.pipe(res);
//   } catch (error) {
//     console.error("Error streaming digital book:", error);
//     res.status(500).json({ error: "Error streaming content" });
//   }
// };









const axios = require("axios");
const Order = require("../models/orderModel");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const streamDigitalBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.id;
    const download = req.query.download === 'true';

    console.log(`Attempting to stream book ${bookId} for user ${userId}`);

    const order = await Order.findOne({
      user: userId,
      "items.book": bookId,
      paymentStatus: "paid",
    }).populate("items.book");

    if (!order) {
      console.log(`No paid order found for book ${bookId} and user ${userId}`);
      return res.status(403).json({ message: "You don't have access to this book" });
    }

    const book = order.items.find((item) => item.book._id.toString() === bookId)?.book;
    if (!book) {
      console.log(`Book ${bookId} not found in order`);
      return res.status(404).json({ message: "Book not found in your order" });
    }

    if (!book.isDigital && !book.isAudiobook) {
      console.log(`Book ${bookId} is not digital or audiobook`);
      return res.status(404).json({ message: "This book is not available in digital format" });
    }

    if (!book.fileUrl) {
      console.log(`No file URL found for book ${bookId}`);
      return res.status(404).json({ message: "Digital content file not found" });
    }

    console.log(`Attempting to stream from URL: ${book.fileUrl}`);
    const isAudio = book.isAudiobook;
    const contentType = isAudio ? "audio/mpeg" : "application/pdf";
    const fileExtension = isAudio ? "mp3" : "pdf";
    const filename = `${book.title || 'content'}.${fileExtension}`;

    try {
      const response = await axios.get(book.fileUrl, { 
        responseType: "stream",
        timeout: 10000, // 10 second timeout
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only accept 2xx status codes
        }
      });

      // Set appropriate headers based on content type
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      if (download) {
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      } else {
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      }

      response.data.pipe(res);
    } catch (streamError) {
      console.error("Error streaming from URL:", streamError.message);
      return res.status(500).json({ 
        error: "Error streaming content",
        details: "Failed to fetch content from storage"
      });
    }
  } catch (error) {
    console.error("Error in streamDigitalBook:", error);
    res.status(500).json({ 
      error: "Error streaming content",
      details: error.message
    });
  }
};

module.exports = { streamDigitalBook };
