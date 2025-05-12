// routes/bookRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../utils/multer");
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
} = require("../controllers/bookController");

// New routes for browsing digital and physical books separately
router.get("/getDigitalBooks", getDigitalBooks);
router.get("/getPhysicalBooks", getPhysicalBooks);
router.get("/audiobooks", getAudiobooks);
router.get("/singleBook/:id", getSingleBook);
router.get("/getBook/myBooks", protect, checkSellerRole, fetchMyBooks);
router.post(
  "/createBook",
  protect,
  checkSellerRole,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  createBook
);
router.put(
  "/updateBook/:id",
  protect,
  checkSellerRole,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  updateBook
);
router.delete("/deleteBook/:id", protect, checkSellerRole, deleteBook);

module.exports = router;