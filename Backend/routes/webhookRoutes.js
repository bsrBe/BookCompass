const express = require("express");
const router = express.Router();
const { handleChapaWebhook } = require("../controllers/webhookController");

router.post("/chapa", handleChapaWebhook);

module.exports = router;
