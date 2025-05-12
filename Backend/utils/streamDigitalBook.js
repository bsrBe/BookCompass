
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










const streamDigitalBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.id;
    const download = req.query.download === 'true';

    const order = await Order.findOne({
      user: userId,
      "items.book": bookId,
      paymentStatus: "paid",
    }).populate("items.book");

    if (!order) {
      return res.status(403).json({ message: "You don't have access to this book" });
    }

    const book = order.items.find((item) => item.book._id.toString() === bookId)?.book;
    // Check if the book exists and is either digital or an audiobook
    if (!book || (!book.isDigital && !book.isAudiobook) || !book.fileUrl) {
      return res.status(404).json({ message: "Digital content not found or inaccessible" });
    }

    const fileUrl = book.fileUrl;
    const isAudio = book.isAudiobook;
    const contentType = isAudio ? "audio/mpeg" : "application/pdf";
    const fileExtension = isAudio ? "mp3" : "pdf";
    const filename = `${book.title || 'content'}.${fileExtension}`;
    const response = await axios.get(fileUrl, { responseType: "stream" });

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
  } catch (error) {
    console.error("Error streaming content:", error); // Generic error message
    res.status(500).json({ error: "Error streaming content" });
  }
};


module.exports = { streamDigitalBook };
