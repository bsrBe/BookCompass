const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");

const {
    recordBookView,
    recordBookRating,
    recordTimeSpent,
    getUserInteractions,
    getRecommendations
} = require("../controllers/interactionController");

// All routes are protected - require authentication
router.use(protect);

// Record interactions
router.post("/view", recordBookView);
router.post("/rate", recordBookRating);
router.post("/time", recordTimeSpent);

// Get user's interaction history
router.get("/history", getUserInteractions);

// Get personalized recommendations
router.get("/recommendations", getRecommendations);

module.exports = router; 