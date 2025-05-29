const express = require("express");
const router = express.Router();
const { protect, checkSellerRole } = require("../middlewares/authMiddleware");
const { getSellerDashboard } = require("../controllers/sellerController");

router.get("/dashboard", protect, checkSellerRole, getSellerDashboard);

module.exports = router;