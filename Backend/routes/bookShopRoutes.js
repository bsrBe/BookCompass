const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  createBookShop,
  updateBookShop,
  getBookShop,
  getMyBookShop,
  createReview,
  getBookShopReviews,
  getNearbyBookshops,
  searchBookshops,
  getAllBookshops,
  updateBookshopFields
} = require("../controllers/bookShopController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Configure multer for bookshop image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Public routes - specific routes first
router.get("/shopList", getAllBookshops);
router.get("/nearby", getNearbyBookshops);
router.get("/search", searchBookshops);

// Public dynamic routes - using regex to ensure id is a valid MongoDB ObjectId
router.get("/:id([0-9a-fA-F]{24})", getBookShop);
router.get("/:id([0-9a-fA-F]{24})/reviews", getBookShopReviews);

// Protected routes
router.use(protect);

// Seller routes
router.get("/my-shop", authorize("seller"), getMyBookShop);
router.patch("/update-fields", authorize("seller"), updateBookshopFields);
router.post(
  "/",
  authorize("seller"),
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'background', maxCount: 1 }
  ]),
  createBookShop
);

// Buyer routes
router.post("/:id([0-9a-fA-F]{24})/reviews", authorize("buyer"), createReview);

module.exports = router; 