// routes/bookRoutes.js
const express = require("express");
const router = express.Router();
// const upload = require("../utils/multer");
const { bookUpload } = require("../utils/multer");

const { protect, checkSellerRole } = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/bookController");

// New routes for browsing digital and physical books separately
router.get("/getAllBooks", getAllBooks);
router.get("/getDigitalBooks", getDigitalBooks);
router.get("/getPhysicalBooks", getPhysicalBooks);
router.get("/audiobooks", getAudiobooks);
router.get("/singleBook/:id", getSingleBook);
router.get("/getBook/myBooks", protect, checkSellerRole, fetchMyBooks);
router.post(
  "/createBook",
  protect,
  checkSellerRole,
bookUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  createBook
);
router.put(
  "/updateBook/:id",
  protect,
  checkSellerRole,
  bookUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  updateBook
);
router.delete("/deleteBook/:id", protect, checkSellerRole, deleteBook);
// Route for most sold books
router.get("/most-sold", getMostSoldBooks);
module.exports = router;
