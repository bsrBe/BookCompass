const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const Book = require("../models/bookModel");
const User = require("../models/userModel");
const asyncHandler = require("../utils/asyncHandler");
const axios = require("axios");
const sendEmail = require("../utils/sendEmail");
const { geocodeAddress } = require("../utils/geocode");
require("dotenv").config();
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
const CHAPA_API_URL = "https://api.chapa.co/v1/transaction/initialize";
const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify/";
const Notification = require("../models/notificationModel");

const getDistance = async (point1, point2) => {
  try {
    const response = await axios.get(
      `http://router.project-osrm.org/route/v1/driving/${point1.lng},${point1.lat};${point2.lng},${point2.lat}?overview=false`
    );

    if (!response.data.routes?.[0]) {
      throw new Error("No route found");
    }

    return response.data.routes[0].distance / 1000; // Convert to km
  } catch (error) {
    console.error("Distance calculation error:", error);
    throw new Error("Failed to calculate distance");
  }
};

const createOrder = async (req, res) => {
  try {
    const { shippingAddress, itemsId } = req.body;
    const userId = req.user.id;

    if (!itemsId || itemsId.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.book",
      populate: [
        { 
          path: "seller", 
          select: "name email"
        },
        {
          path: "shop",
          select: "location"
        }
      ],
    });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found for this user" });
    }

    const selectedItems = cart.items.filter((item) =>
      itemsId.includes(item.book._id.toString())
    );
    if (selectedItems.length === 0) {
      return res.status(400).json({ message: "No valid items selected from the cart" });
    }

    const hasPhysicalItems = selectedItems.some((item) => !item.book.isDigital && !item.book.isAudiobook);

    if (hasPhysicalItems && !shippingAddress) {
      return res.status(400).json({ message: "Shipping address or Google Maps URL is required for physical items" });
    }

    const existingOrder = await Order.findOne({
      user: userId,
      "items.book": { $all: itemsId },
      paymentStatus: { $in: ["pending", "completed"] },
    });
    if (existingOrder) {
      const existingItemsMap = new Map(
        existingOrder.items.map((item) => [item.book._id.toString(), item.quantity])
      );
      const isRedundant = selectedItems.every(
        (newItem) => existingItemsMap.get(newItem.book._id.toString()) === newItem.quantity
      );
      if (isRedundant) {
        return res.status(400).json({
          message: "This order has already been placed",
          existingOrderId: existingOrder._id,
        });
      }
    }

    const sellerGroups = new Map();
    selectedItems.forEach((item) => {
      const sellerId = item.book.seller._id.toString();
      if (!sellerGroups.has(sellerId)) {
        const hasValidLocation =
          item.book.shop &&
          item.book.shop.location &&
          item.book.shop.location.coordinates &&
          Array.isArray(item.book.shop.location.coordinates) &&
          item.book.shop.location.coordinates.length === 2 &&
          typeof item.book.shop.location.coordinates[0] === 'number' &&
          typeof item.book.shop.location.coordinates[1] === 'number';

        console.log('Seller location validation:', {
          sellerId,
          shop: item.book.shop,
          hasValidLocation,
          coordinates: item.book.shop?.location?.coordinates
        });

        sellerGroups.set(sellerId, {
          seller: item.book.seller,
          physicalItems: [],
          digitalItems: [],
          audiobookItems: [],
          subtotal: 0,
          hasValidLocation,
          sellerLocation: hasValidLocation
            ? { lat: item.book.shop.location.coordinates[1], lng: item.book.shop.location.coordinates[0] }
            : null,
        });
      }

      const sellerGroup = sellerGroups.get(sellerId);
      const orderItem = {
        book: item.book._id,
        quantity: item.quantity,
        price: item.book.price,
        seller: sellerId,
        isDigital: item.book.isDigital,
        isAudiobook: item.book.isAudiobook,
      };

      if (item.book.isAudiobook) {
        sellerGroup.audiobookItems.push(orderItem);
      } else if (item.book.isDigital) {
        sellerGroup.digitalItems.push(orderItem);
      } else {
        sellerGroup.physicalItems.push(orderItem);
      }
      sellerGroup.subtotal += orderItem.price * orderItem.quantity;
    });

    const sellerGroupsArray = Array.from(sellerGroups.values());
    let shippingCoords = null;

    if (hasPhysicalItems) {
      try {
        const geocoded = await geocodeAddress(shippingAddress);
        if (!geocoded || !geocoded.lat || !geocoded.lng) {
          throw new Error("Invalid shipping address or Google Maps URL");
        }
        shippingCoords = [geocoded.lng, geocoded.lat];
      } catch (geocodeError) {
        console.error("Geocoding failed:", geocodeError.message);
        return res.status(400).json({ 
          message: "Could not validate the shipping address or Google Maps URL. Please provide a valid address or Google Maps URL." 
        });
      }
    }

    await Promise.all(
      sellerGroupsArray.map(async (group) => {
        if (group.physicalItems.length > 0) {
          console.log(`Processing delivery fee for seller ${group.seller._id}:`, {
            hasValidLocation: group.hasValidLocation,
            sellerLocation: group.sellerLocation,
            shippingCoords,
            sellerLocationType: typeof group.sellerLocation,
            sellerLocationLat: group.sellerLocation?.lat,
            sellerLocationLng: group.sellerLocation?.lng
          });

          if (!group.hasValidLocation || !group.sellerLocation) {
            console.log(`Using fallback delivery fee for seller ${group.seller._id} - Invalid location`);
            group.deliveryFee = 100;
            group.distance = null;
            group.fromLocation = {
              type: "Point",
              coordinates: [38.7636, 9.0054],
              note: "Default location used",
            };
          } else {
            try {
              console.log(`Attempting distance calculation between:`, {
                from: {
                  lat: group.sellerLocation.lat,
                  lng: group.sellerLocation.lng
                },
                to: {
                  lat: shippingCoords[1],
                  lng: shippingCoords[0]
                }
              });

              const distance = await getDistance(group.sellerLocation, {
                lat: shippingCoords[1],
                lng: shippingCoords[0],
              });
              console.log(`Calculated distance for seller ${group.seller._id}:`, {
                distance,
                calculatedFee: Math.max(50, Math.min(distance * 10, 500))
              });
              group.deliveryFee = Math.max(50, Math.min(distance * 10, 500));
              group.distance = distance;
              group.fromLocation = {
                type: "Point",
                coordinates: [group.sellerLocation.lng, group.sellerLocation.lat],
              };
            } catch (error) {
              console.error(`Delivery calculation failed for seller ${group.seller._id}:`, error.message);
              group.deliveryFee = 100;
              group.distance = null;
              group.fromLocation = {
                type: "Point",
                coordinates: [38.7636, 9.0054],
                note: "Default location used",
              };
            }
          }
        } else {
          group.deliveryFee = 0;
          group.distance = null;
          group.fromLocation = null;
        }
        group.total = group.subtotal + (group.deliveryFee || 0);
      })
    );

    const allOrderItems = sellerGroupsArray.flatMap((group) => [
      ...group.physicalItems,
      ...group.digitalItems,
      ...group.audiobookItems,
    ]);

    const order = new Order({
      user: userId,
      cart: cart._id,
      items: allOrderItems,
      pricing: {
        subtotal: sellerGroupsArray.reduce((sum, g) => sum + g.subtotal, 0),
        deliveryFee: sellerGroupsArray.reduce((sum, g) => sum + (g.deliveryFee || 0), 0),
        total: sellerGroupsArray.reduce((sum, g) => sum + g.total, 0),
        sellerBreakdown: sellerGroupsArray.map((group) => ({
          seller: group.seller._id,
          subtotal: group.subtotal,
          deliveryFee: group.deliveryFee || 0,
          total: group.total,
          distance: group.distance,
          fromLocation: group.fromLocation,
          toLocation: group.physicalItems.length > 0 ? { type: "Point", coordinates: shippingCoords } : null,
        })),
      },
      shippingAddress: hasPhysicalItems ? shippingAddress : null,
      shippingLocation: hasPhysicalItems ? { type: "Point", coordinates: shippingCoords } : null,
      paymentStatus: "pending",
      txRef: `order-${userId}-${Date.now()}`,
    });

    await order.save();

    const paymentData = {
      amount: order.pricing.total.toString(),
      currency: "ETB",
      email: req.user.email || "customer@example.com",
      first_name: req.user.name?.split(" ")[0] || "Customer",
      last_name: req.user.name?.split(" ")[1] || "User",
      tx_ref: order.txRef,
      callback_url: `https://bookcompass.onrender.com/api/order/payment-callback?tx_ref=${order.txRef}`,
      return_url: `https://bookcompass.onrender.com/api/order/payment-success?tx_ref=${order.txRef}`,
      "customization[title]": "Book Order Payment",
      "customization[description]": `Payment for order #${order._id}`,
    };

    const response = await axios.post(CHAPA_API_URL, paymentData, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data.status === "success") {
      cart.items = cart.items.filter((item) => !itemsId.includes(item.book._id.toString()));
      cart.totalPrice = cart.items.reduce(
        (total, item) => (item.book?.price ? total + item.quantity * item.book.price : total),
        0
      );
      await cart.save();

      return res.status(200).json({
        order,
        checkoutUrl: response.data.data.checkout_url,
        txRef: order.txRef,
      });
    } else {
      throw new Error("Payment initiation failed");
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    res.status(400).json({
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { tx_ref } = req.query;
    if (!tx_ref) {
      return res.status(400).json({ message: "Transaction reference (tx_ref) is missing" });
    }

    const verifyUrl = `${CHAPA_VERIFY_URL}${tx_ref}`;
    const response = await axios.get(verifyUrl, {
      headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
    });

    const order = await Order.findOne({ txRef: tx_ref }).populate("items.book");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (response.data.status === "success" && response.data.data.status === "success") {
      order.paymentStatus = "paid";
      order.orderStatus = "processing";
      order.transactionDetails = response.data.data;

      for (const item of order.items) {
        if (!item.book.isDigital && !item.book.isAudiobook) {
          const book = await Book.findById(item.book._id);
          if (!book) {
            throw new Error(`Book with ID ${item.book._id} not found`);
          }
          if (typeof book.stock !== "number") {
            throw new Error(`Invalid stock value for book ${item.book._id}: ${book.stock}`);
          }
          await Book.findByIdAndUpdate(item.book._id, { $inc: { stock: -item.quantity } });
        }
      }

      await order.save();

      const updatedOrder = await Order.findById(order._id);
      if (updatedOrder.paymentStatus !== "paid") {
        throw new Error("Failed to update order payment status");
      }

      res.redirect(`/api/order/payment-success?tx_ref=${tx_ref}`);
    } else {
      order.paymentStatus = "failed";
      await order.save();
      res.status(400).json({ message: "Payment verification failed", details: response.data });
    }
  } catch (error) {
    console.error("Error verifying payment:", error.response ? error.response.data : error.message);
    res.status(500).json({
      error: "Error verifying payment",
      details: error.response ? error.response.data : error.message,
    });
  }
};

const paymentSuccess = async (req, res) => {
  try {
    const { tx_ref } = req.query;
    if (!tx_ref) {
      return res.status(400).json({ message: "Transaction reference (tx_ref) is missing" });
    }

    let order;
    let attempts = 0;
    const maxAttempts = 3;
    const delay = 500;

    while (attempts < maxAttempts) {
      order = await Order.findOne({ txRef: tx_ref })
        .populate("items.book")
        .populate("items.seller");

      if (order && order.paymentStatus === "paid") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      attempts++;
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      const chapaReceiptUrl = `https://checkout.chapa.co/checkout/${
        order.transactionDetails.mode === "test" ? "test-" : ""
      }payment-receipt/${order.transactionDetails.reference}`;

      res.status(200).json({
        message: "Payment successful!",
        orderDetails: {
          items: order.items.map((item) => ({
            bookTitle: item.book.title,
            price: item.price,
            quantity: item.quantity,
            sellerName: item.seller.name,
            isDigital: item.book.isDigital,
            isAudiobook: item.book.isAudiobook,
            accessUrl: (item.book.isDigital || item.book.isAudiobook)
              ? `${req.protocol}://${req.get("host")}/api/order/stream/${item.book._id}`
              : null,
          })),
          pricing: {
            subtotal: order.pricing.subtotal,
            deliveryFee: order.pricing.deliveryFee,
            total: order.pricing.total,
          },
        },
        paymentDetails: {
          amount: order.transactionDetails.amount,
          currency: order.transactionDetails.currency,
          charge: order.transactionDetails.charge,
          status: order.transactionDetails.status,
          reference: order.transactionDetails.reference,
          date: order.transactionDetails.created_at,
          receiptUrl: chapaReceiptUrl,
        },
      });
    } else {
      res.status(400).json({
        message: "Payment not completed",
        orderStatus: order.paymentStatus,
      });
    }
  } catch (error) {
    console.error("Error in paymentSuccess:", error.response ? error.response.data : error.message);
    res.status(500).json({
      error: "Error retrieving transaction details",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const streamDigitalBook = async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const userId = req.user.id;
    const download = req.query.download === "true";

    const book = await Book.findById(bookId);
    if (!book || (!book.isDigital && !book.isAudiobook) || !book.fileUrl) {
      return res.status(404).json({ error: "Digital book or audiobook not found" });
    }

    const order = await Order.findOne({
      user: userId,
      "items.book": bookId,
      paymentStatus: "paid",
    });

    if (!order) {
      return res.status(403).json({ error: "You do not have access to this content" });
    }

    const response = await axios({
      url: book.fileUrl,
      method: "GET",
      responseType: "stream",
    });

    const sanitizeFilename = (title) => {
      return title
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "_")
        .toLowerCase();
    };
    const filename = `${sanitizeFilename(book.title)}.${book.isAudiobook ? "mp3" : "pdf"}`;

    res.setHeader("Content-Type", book.isAudiobook ? "audio/mpeg" : "application/pdf");
    res.setHeader(
      "Content-Disposition",
      download
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    response.data.pipe(res);
  } catch (error) {
    console.error("Error streaming content:", error);
    res.status(500).json({ error: error.message });
  }
};

const getOrder = async (req, res) => {
  const isSeller = req.user.role === "seller";
  const userId = req.user.id;

  try {
    if (!isSeller) {
      const userOrders = await Order.find({ user: userId })
        .populate("user", "name email")
        .populate("items.book");

      if (!userOrders || userOrders.length === 0) {
        return res.status(404).json({ error: "No orders found for this user" });
      }

      return res.status(200).json({ success: true, data: userOrders });
    }

    const sellerBooks = await Book.find({ seller: userId }).select("_id");

    if (sellerBooks.length === 0) {
      return res.status(404).json({ error: "No books found for this seller" });
    }

    const bookIds = sellerBooks.map((book) => book._id);

    const sellerOrders = await Order.find({ "items.book": { $in: bookIds } })
      .populate("user", "name email")
      .populate("items.book", "title price isDigital isAudiobook");

    if (sellerOrders.length === 0) {
      return res.status(404).json({ error: "No orders found for this seller" });
    }

    return res.status(200).json({ success: true, data: sellerOrders });
  } catch (error) {
    console.error("Error in getOrders:", error);
    res.status(400).json({ error: error.message });
  }
};

const getSingleOrder = async (req, res) => {
  const isSeller = req.user.role === "seller";
  const sellerId = req.user.id;
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Order ID format" });
    }
    if (!isSeller) {
      const userSingleOrder = await Order.findOne({ _id: id, user: req.user.id });
      if (!userSingleOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      return res.status(200).json(userSingleOrder);
    }

    const sellerBooks = await Book.find({ seller: sellerId }).select("_id");
    const bookIds = sellerBooks.map((book) => book._id);
    if (bookIds.length === 0) {
      return res.status(404).json({ error: "Seller has no books, no associated orders" });
    }

    const singleOrders = await Order.findOne({ _id: id, "items.book": { $in: bookIds } })
      .populate("user", "name email")
      .populate("items.book", "title price isDigital isAudiobook");
    if (!singleOrders) {
      return res.status(404).json({ error: "Order not found or not associated with seller" });
    }
    return res.status(200).json(singleOrders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus } = req.body;
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email'); // Populate user details

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if orderStatus is provided
  if (!orderStatus) {
    res.status(400);
    throw new Error("Order status is required");
  }

  // Trim whitespace from status
  const trimmedStatus = orderStatus.trim();

  // Check if status is valid
  const validStatuses = ["processing", "shipped", "delivered", "canceled"];
  if (!validStatuses.includes(trimmedStatus)) {
    res.status(400);
    throw new Error("Invalid status. Must be one of: processing, shipped, delivered, canceled");
  }

  // Validate status transition
  const currentStatus = order.orderStatus;
  const validTransitions = {
    processing: ["shipped", "canceled"],
    shipped: ["delivered"],
    delivered: [],
    canceled: []
  };

  if (!validTransitions[currentStatus].includes(trimmedStatus)) {
    res.status(400);
    throw new Error(`Cannot change status from ${currentStatus} to ${trimmedStatus}. Valid transitions from ${currentStatus} are: ${validTransitions[currentStatus].join(", ")}`);
  }

  // Update order status
  order.orderStatus = trimmedStatus;
  await order.save();

  // Create notification for the user
  const notification = await Notification.create({
    user: order.user._id,
    order: order._id,
    message: `Your order #${order._id} status has been updated to ${trimmedStatus}`,
    status: trimmedStatus,
    eventType: "order_status_update",
    isRead: false
  });

  res.json({ 
    success: true,
    message: "Order status updated successfully",
    order,
    notification
  });
});

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    const order = await Order.findById(id)
      .populate("items.book")
      .populate("items.seller");

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (!order.user.equals(userId) && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to cancel this order." });
    }

    const cancellableStatuses = ["pending", "processing"];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({ error: "Order cannot be canceled at this stage." });
    }

    order.orderStatus = "canceled";
    order.cancelledAt = new Date();
    if (reason) order.cancellationReason = reason;

    // 🔁 Refund Logic if payment was already made
    if (order.paymentStatus === "paid") {
      try {
        const refundUrl = `https://api.chapa.co/v1/refund/${order.txRef}`;
        const refundPayload = new URLSearchParams();
        refundPayload.append("reason", reason || "Buyer cancelled the order");
        const generatedRefundRef = `refund-${Date.now()}`;
        refundPayload.append("reference", generatedRefundRef);
        refundPayload.append("meta[order_id]", order._id.toString());

        const refundResponse = await axios.post(refundUrl, refundPayload, {
          headers: {
            Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        if (refundResponse.data.status === "success") {
          console.log(`✅ Refund initiated for order ${order._id}`);

          // 🧾 Store refund details in DB
          order.refundStatus = "initiated";
          order.refundReference = refundResponse.data.data.ref || generatedRefundRef;
          order.refundDetails = refundResponse.data.data;

          // ✉️ Notify Buyer
          const buyer = await User.findById(order.user).select("email name");
          if (buyer && buyer.email) {
            await sendEmail({
              email: buyer.email,
              subject: `Refund initiated for Order #${order._id}`,
              message: `Hello ${buyer.name || "Customer"},\n\nYour cancellation request for Order #${order._id} has been processed.\n\nReason: ${reason || "Not specified"}\nRefund Amount: Full order amount\n\nRefunds are processed by Chapa and may take 1–3 business days to appear on your original payment method.\n\nThank you for shopping with us.`,
            });
          }
        } else {
          console.warn(`❌ Refund request failed for order ${order._id}:`, refundResponse.data.message);
          order.refundStatus = "failed";
        }
      } catch (refundErr) {
        console.error("❌ Error initiating refund with Chapa:", refundErr.response?.data || refundErr.message);
        order.refundStatus = "failed";
      }
    }

    // 📦 Restock inventory for physical items
    for (const item of order.items) {
      if (!item.isDigital && !item.isAudiobook) {
        await Book.findByIdAndUpdate(item.book._id, {
          $inc: { stock: item.quantity },
        });
      }
    }

    await order.save();

    // ✉️ Notify Sellers
    const sellerEmails = [...new Set(order.items.map(i => i.seller?.email).filter(Boolean))];
    for (const email of sellerEmails) {
      await sendEmail({
        email,
        subject: `Order #${order._id} has been cancelled`,
        message: `Hello,\n\nThe buyer has cancelled Order #${order._id}.\nReason: ${reason || "No reason provided"}\n\nPlease check your seller dashboard for more details.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order canceled successfully.",
      order,
    });

  } catch (error) {
    console.error("Order cancellation error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Order ID format" });
    }

    const order = await Order.findByIdAndDelete({ _id: id });

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.status(200).json({ success: true, message: "Order deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getOrderReports = async (req, res) => {
  const isSeller = req.user.role === "seller";
  const sellerId = req.user.id;
  try {
    if (req.user.role === "seller") {
      const sellerBooks = await Book.find({ seller: req.user.id }).select("_id");

      if (sellerBooks.length === 0) {
        return res.status(404).json({ error: "No books found for this seller." });
      }

      const bookIds = sellerBooks.map((book) => book._id);

      const orders = await Order.aggregate([
        { $match: { "items.book": { $in: bookIds } } },
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 },
            totalRevenue: { $sum: "$pricing.total" },
          },
        },
      ]);

      res.status(200).json({ success: true, data: orders });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createOrder,
  getOrder,
  getSingleOrder,
  updateOrderStatus,
  deleteOrder,
  cancelOrder,
  getOrderReports,
  verifyPayment,
  paymentSuccess,
  streamDigitalBook,
};
