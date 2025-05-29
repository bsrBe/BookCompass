const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    type: {
        type: String,
        enum: ['view', 'rating', 'timeSpent'],
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: function() {
            return this.type === 'rating';
        }
    },
    duration: {
        type: Number,
        min: 0,
        required: function() {
            return this.type === 'timeSpent';
        }
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique combinations and faster queries
interactionSchema.index({ userId: 1, bookId: 1, type: 1 });

const Interaction = mongoose.model('Interaction', interactionSchema);

module.exports = Interaction; 