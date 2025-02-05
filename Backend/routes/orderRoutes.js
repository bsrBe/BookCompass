const express = require("express");
const router = express.Router();
const { 
  createOrder, 
  getOrder, 
  getSingleOrder, 
  updateOrderStatus, 
  deleteOrder, 
  cancelOrder, 
  getOrderReports 
} = require("../controllers/orderController");

const { protect, checkSellerRole } = require("../middlewares/authMiddleware"); // Assuming auth middleware exists

// Create an order (Only for authenticated users)
router.post("/createOrder", protect, createOrder);

// Get all orders (Users get their own orders, sellers get their related orders)
router.get("/getOrder", protect, getOrder);

// Get a single order by ID (Only if the user/seller is authorized to see it)
router.get("/getOrder/:id", protect, getSingleOrder);

// Update order status (Only for sellers or admins)
router.put("/updateOrder/:id/status", protect, checkSellerRole, updateOrderStatus);

// Cancel an order (Only if it is in "processing" state)
router.put("/updateStatus/:id/cancel", protect, cancelOrder);

// Delete an order (For admin only)
router.delete("/deleteOrder/:id", protect, checkSellerRole , deleteOrder);

// Get order reports (Admin access)
router.get("/reports", protect, checkSellerRole, getOrderReports);

module.exports = router;
