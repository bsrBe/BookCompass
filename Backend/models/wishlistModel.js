const mongoose = require("mongoose");
const Joi = require("joi");

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'removed'],
        default: 'active'
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Create a compound index to ensure a user can't add the same book twice
wishlistSchema.index({ user: 1, book: 1 }, { unique: true });

// Validation function
function validateWishlist(wishlist) {
    const schema = Joi.object({
        book: Joi.string().required(),
        status: Joi.string().valid('active', 'removed')
    });
    return schema.validate(wishlist);
}

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

module.exports = {
    Wishlist,
    validateWishlist
}; 