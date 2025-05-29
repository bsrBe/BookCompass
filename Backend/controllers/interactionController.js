const User = require("../models/userModel");
const Book = require("../models/bookModel");
const Interaction = require("../models/interactionModel");

// Record when a user views a book
exports.recordBookView = async (req, res) => {
    try {
        const { bookId } = req.body;
        const userId = req.user.id;

        const interaction = await Interaction.create({
            userId,
            bookId,
            type: 'view',
            timestamp: Date.now()
        });

        res.status(201).json(interaction);
    } catch (error) {
        res.status(500).json({ message: "Error recording book view", error: error.message });
    }
};

// Record a book rating
exports.recordBookRating = async (req, res) => {
    try {
        const { bookId, rating } = req.body;
        const userId = req.user.id;

        // Update existing rating or create new one
        const interaction = await Interaction.findOneAndUpdate(
            { userId, bookId, type: 'rating' },
            { 
                userId,
                bookId,
                type: 'rating',
                rating,
                timestamp: Date.now()
            },
            { upsert: true, new: true }
        );

        // Update book's average rating
        const allRatings = await Interaction.find({ bookId, type: 'rating' });
        const avgRating = allRatings.reduce((acc, curr) => acc + curr.rating, 0) / allRatings.length;
        await Book.findByIdAndUpdate(bookId, { rating: avgRating });

        res.status(200).json(interaction);
    } catch (error) {
        res.status(500).json({ message: "Error recording book rating", error: error.message });
    }
};

// Record time spent on a book
exports.recordTimeSpent = async (req, res) => {
    try {
        const { bookId, duration } = req.body;
        const userId = req.user.id;

        // Update existing time record or create new one
        const interaction = await Interaction.findOneAndUpdate(
            { userId, bookId, type: 'timeSpent' },
            { 
                $inc: { duration },
                timestamp: Date.now()
            },
            { upsert: true, new: true }
        );

        res.status(200).json(interaction);
    } catch (error) {
        res.status(500).json({ message: "Error recording time spent", error: error.message });
    }
};

// Get all interactions for a user
exports.getUserInteractions = async (req, res) => {
    try {
        const userId = req.user.id;
        const interactions = await Interaction.find({ userId })
            .populate('bookId', 'title author coverImage')
            .sort('-timestamp');

        res.status(200).json(interactions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching user interactions", error: error.message });
    }
};

// Get personalized recommendations based on user interactions
exports.getRecommendations = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's interactions
        const userInteractions = await Interaction.find({ userId });
        
        // Get user's preferred genres from rated books
        const ratedBookIds = userInteractions
            .filter(i => i.type === 'rating' && i.rating >= 4)
            .map(i => i.bookId);
        
        const ratedBooks = await Book.find({ _id: { $in: ratedBookIds } });
        const preferredGenres = [...new Set(ratedBooks.flatMap(b => b.genres))];

        // Find books in preferred genres that user hasn't interacted with
        const interactedBookIds = userInteractions.map(i => i.bookId);
        const recommendations = await Book.find({
            _id: { $nin: interactedBookIds },
            genres: { $in: preferredGenres }
        })
        .sort('-rating')
        .limit(10);

        res.status(200).json(recommendations);
    } catch (error) {
        res.status(500).json({ message: "Error getting recommendations", error: error.message });
    }
}; 