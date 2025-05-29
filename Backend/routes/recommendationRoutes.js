const express = require('express');
const router = express.Router();
const {
  recordView,
  recordRating,
  recordTimeSpent,
} = require('../controllers/recommendationController');
const { protect} = require("../middlewares/authMiddleware");
router.post('/view',protect ,recordView);
router.post('/rate',protect ,recordRating);
router.post('/time', protect,recordTimeSpent);

module.exports = router;
