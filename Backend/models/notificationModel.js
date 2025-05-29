const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ["processing", "shipped", "delivered", "canceled"],
      required: true,
    },
    eventType: {
      type: String,
      enum: ["order_status_update", "order_confirmation", "payment_success"],
      default: "order_status_update",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);