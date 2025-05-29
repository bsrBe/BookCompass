const asyncHandler = require("express-async-handler");
const Notification = require("../models/notificationModel");

const getUserNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id })
    .sort({ createdAt: -1 }) // Newest first
    .lean();

  res.json(notifications);
});

module.exports = { getUserNotifications };