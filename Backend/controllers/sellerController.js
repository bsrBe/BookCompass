const asyncHandler = require("express-async-handler");
const Book = require("../models/bookModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");
const BookShop = require("../models/bookShopModel");

const getSellerDashboard = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  // Check if seller has a bookshop
  const bookShop = await BookShop.findOne({ seller: sellerId });
  if (!bookShop) {
    return res.status(404).json({ 
      message: "No bookshop found. Please create one to start selling books.",
      needsBookShop: true
    });
  }

  // Parse and validate date range
  let startDate, endDate;
  const currentDate = new Date();
  try {
    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
      if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
        throw new Error("Invalid date range");
      }
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = currentDate;
      startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - 30);
    }
  } catch (error) {
    console.error("Invalid date range:", error);
    endDate = currentDate;
    startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 30);
  }

  // Total books count
  const availableBooks = await Book.countDocuments({ seller: sellerId });

  // Get all orders for the seller in the date range
  const orders = await Order.find({
    "items.seller": sellerId,
    orderStatus: { $ne: "canceled" },
    refundStatus: { $ne: "completed" },
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();

  // Calculate summary statistics
  const summary = {
    totalOrders: 0,
    paidAndDeliveredOrders: 0,
    pendingPaymentOrders: 0,
    processingOrders: 0,
    totalRevenue: 0
  };

  // Process each order to calculate summary
  orders.forEach(order => {
    const sellerBreakdown = order.pricing.sellerBreakdown?.find(
      (s) => s.seller.toString() === sellerId
    );

    if (order.paymentStatus === "paid") {
      summary.totalOrders++;
      summary.totalRevenue += sellerBreakdown?.total || 0;
      
      if (order.orderStatus === "delivered") {
        summary.paidAndDeliveredOrders++;
      } else if (order.orderStatus === "processing") {
        summary.processingOrders++;
      }
    } else if (order.paymentStatus === "pending") {
      summary.pendingPaymentOrders++;
    }
  });

  // Get detailed orders list
  const detailedOrders = await Order.find({
    "items.seller": sellerId,
    $or: [
      { paymentStatus: "paid" },
      { paymentStatus: "pending" }
    ],
    orderStatus: { $ne: "canceled" },
    refundStatus: { $ne: "completed" },
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .select("orderStatus paymentStatus user items pricing shippingAddress createdAt")
    .populate("user", "name")
    .populate("items.book", "title")
    .sort({ createdAt: -1 })
    .lean();

  // Format orders for response
  const formattedOrders = detailedOrders.map((order) => {
    const sellerBreakdown = order.pricing.sellerBreakdown?.find(
      (s) => s.seller.toString() === sellerId
    );

    return {
      _id: order._id,
      buyer: {
        _id: order.user._id,
        name: order.user.name,
      },
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      pricing: {
        subtotal: order.pricing.subtotal,
        deliveryFee: order.pricing.deliveryFee,
        total: order.pricing.total,
        sellerEarnings: sellerBreakdown?.total || 0,
      },
      shippingAddress: order.shippingAddress,
      books: order.items
        .filter((item) => item.seller.toString() === sellerId)
        .map((item) => ({
          title: item.book.title,
          quantity: item.quantity,
        })),
      createdAt: order.createdAt,
    };
  });

  // Get bookshop details
  const bookShopDetails = {
    name: bookShop.name,
    tagline: bookShop.tagline,
    description: bookShop.description,
    services: bookShop.services,
    contact: bookShop.contact,
    operatingHours: bookShop.operatingHours,
    socialMedia: bookShop.socialMedia,
    upcomingEvents: bookShop.upcomingEvents,
    images: bookShop.images,
    averageRating: bookShop.averageRating,
    numReviews: bookShop.numReviews
  };

  res.json({
    bookShop: bookShopDetails,
    summary: {
      ...summary,
      availableBooks,
    },
    orders: formattedOrders,
  });
});

module.exports = { getSellerDashboard };