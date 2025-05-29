const { Wishlist, validateWishlist } = require('../models/wishlistModel');
const Book = require('../models/bookModel');
const Cart = require('../models/cartModel');
const asyncHandler = require('express-async-handler');

// @desc    Add book to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
    const { error } = validateWishlist(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    const book = await Book.findById(req.body.book);
    if (!book) {
        return res.status(404).json({ message: 'Book not found' });
    }

    const wishlistItem = await Wishlist.findOne({
        user: req.user._id,
        book: req.body.book
    });

    if (wishlistItem) {
        if (wishlistItem.status === 'removed') {
            wishlistItem.status = 'active';
            await wishlistItem.save();
            return res.status(200).json(wishlistItem);
        }
        return res.status(400).json({ message: 'Book already in wishlist' });
    }

    const newWishlistItem = await Wishlist.create({
        user: req.user._id,
        book: req.body.book
    });

    res.status(201).json(newWishlistItem);
});

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.find({ 
        user: req.user._id,
        status: 'active'
    }).populate('book');

    res.status(200).json(wishlist);
});

// @desc    Remove book from wishlist
// @route   DELETE /api/wishlist/:id
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
    const wishlistItem = await Wishlist.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist item not found' });
    }

    wishlistItem.status = 'removed';
    await wishlistItem.save();

    res.status(200).json({ message: 'Book removed from wishlist' });
});

// @desc    Add wishlist item to cart
// @route   POST /api/wishlist/:id/cart
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
    const wishlistItem = await Wishlist.findOne({
        _id: req.params.id,
        user: req.user._id,
        status: 'active'
    }).populate('book');

    if (!wishlistItem) {
        return res.status(404).json({ message: 'Wishlist item not found' });
    }

    const book = wishlistItem.book;
    if (!book) {
        return res.status(404).json({ message: 'Book not found' });
    }

    // Check if book is in stock
    if (!book.isDigital && !book.isAudiobook && book.stock < 1) {
        return res.status(400).json({ message: 'Book is out of stock' });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
        cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Check if book is already in cart
    const existingItem = cart.items.find(item => item.book.toString() === book._id.toString());
    if (existingItem) {
        return res.status(400).json({ message: 'Book already in cart' });
    }

    // Add book to cart
    cart.items.push({
        book: book._id,
        quantity: 1,
        price: book.price || 0  // Ensure price is a number
    });

    // Update cart total with proper number handling
    cart.totalPrice = cart.items.reduce((total, item) => {
        const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
        return total + itemTotal;
    }, 0);
    await cart.save();

    // Remove from wishlist
    // wishlistItem.status = 'removed';
    // await wishlistItem.save();

    res.status(200).json({
        message: 'Book added to cart successfully',
        cart
    });
});

module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist,
    addToCart
}; 
