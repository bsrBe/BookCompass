const express = require('express');
const router = express.Router();
const {
    addToWishlist,
    getWishlist,
    removeFromWishlist,
    addToCart
} = require('../controllers/wishlistController');
const { protect } = require('../middlewares/authMiddleware');

// All routes are protected and require authentication
router.use(protect);

// Add book to wishlist
router.post('/', addToWishlist);

// Get user's wishlist
router.get('/', getWishlist);

// Remove book from wishlist
router.delete('/:id', removeFromWishlist);

// Add wishlist item to cart
router.post('/:id/cart', addToCart);

module.exports = router; 