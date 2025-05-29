const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getLibrary,
    getUserNotifications,
    getMyProfile,
    updateProfile,
    updateProfileImage,
    getMyOrders,
    getMyWishlist,
    getMyReadingHistory,
    deleteMyAccount
} = require("../controllers/userController");
const { profileUpload } = require("../utils/multer");

// Public routes
router.post("/", createUser);

// Protected routes
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateProfile);
router.put("/me/image", protect, profileUpload.single("profileImage"), updateProfileImage);
router.get("/me/orders", protect, getMyOrders);
router.get("/me/wishlist", protect, getMyWishlist);
router.get("/me/reading-history", protect, getMyReadingHistory);
router.delete("/me", protect, deleteMyAccount);

// Admin routes
router.get("/", protect, getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
