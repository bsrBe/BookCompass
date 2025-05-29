const crypto = require("crypto");
const Order = require("../models/orderModel");

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

const handleChapaWebhook = async (req, res) => {
  try {
    // Verify signature
    const receivedSig = req.headers["x-chapa-signature"] || req.headers["chapa-signature"];
    const generatedSig = crypto
      .createHmac("sha256", CHAPA_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (!receivedSig || receivedSig !== generatedSig) {
      console.warn("Webhook signature verification failed.");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body;

    // Handle successful payments
    if (event.event === "charge.success" && event.tx_ref) {
      const order = await Order.findOne({ txRef: event.tx_ref });
      if (order) {
        order.paymentStatus = "paid";
        order.orderStatus = "processing";
        order.transactionDetails = event;
        await order.save();
        console.log(`✅ Payment marked as successful for Order #${order._id}`);
      } else {
        console.warn(`Order not found for tx_ref: ${event.tx_ref}`);
      }
    }

    // Handle refunds
    if (event.event === "charge.refunded" && event.tx_ref) {
      const order = await Order.findOne({ txRef: event.tx_ref });
      if (order) {
        order.refundStatus = "completed";
        order.refundDetails = event;
        await order.save();
        console.log(`✅ Refund marked as completed for Order #${order._id}`);
      } else {
        console.warn(`Order not found for tx_ref: ${event.tx_ref}`);
      }
    }

    return res.sendStatus(200); // Acknowledge the event
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Internal webhook error" });
  }
};

module.exports = { handleChapaWebhook };
