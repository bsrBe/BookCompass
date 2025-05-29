const mongoose = require("mongoose");

const bookShopReviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    bookShop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookShop",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        maxlength: [255, "Comment cannot be more than 255 characters"]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure a user can only review a bookshop once
bookShopReviewSchema.index({ user: 1, bookShop: 1 }, { unique: true });

// Middleware to update bookshop's average rating and number of reviews
bookShopReviewSchema.post('save', async function() {
    const BookShop = mongoose.model('BookShop');
    const bookShop = await BookShop.findById(this.bookShop);
    
    if (bookShop) {
        const reviews = await this.constructor.find({ bookShop: this.bookShop });
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        
        bookShop.averageRating = totalRating / reviews.length;
        bookShop.numReviews = reviews.length;
        await bookShop.save();
    }
});

// Middleware to update bookshop's average rating and number of reviews after deletion
bookShopReviewSchema.post('remove', async function() {
    const BookShop = mongoose.model('BookShop');
    const bookShop = await BookShop.findById(this.bookShop);
    
    if (bookShop) {
        const reviews = await this.constructor.find({ bookShop: this.bookShop });
        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            bookShop.averageRating = totalRating / reviews.length;
            bookShop.numReviews = reviews.length;
        } else {
            bookShop.averageRating = 0;
            bookShop.numReviews = 0;
        }
        await bookShop.save();
    }
});

module.exports = mongoose.model("BookShopReview", bookShopReviewSchema); 