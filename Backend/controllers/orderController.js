// // controllers/orderController.js
// const mongoose = require("mongoose");
// const Order = require("../models/orderModel");
// const Cart = require("../models/cartModel");
// const Book = require("../models/bookModel");
// const User = require("../models/userModel");
// const axios = require("axios");
// require("dotenv").config();
// const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
// const CHAPA_API_URL = "https://api.chapa.co/v1/transaction/initialize";
// const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify/";

// const geocodeAddress = async (address) => {
//   try {
//     const cleanedAddress = address
//       .replace(/,+/g, ", ")
//       .replace(/\s+/g, " ")
//       .trim();

//     const ETHIOPIAN_LOCATIONS = {
//       mexico: { lat: 9.001442, lng: 38.6771697 },
//       "mexico, addis ababa": { lat: 9.001442, lng: 38.6771697 },
//       bole: { lat: 8.9806, lng: 38.7998 },
//       piassa: { lat: 9.0300, lng: 38.7500 },
//     };

//     const normalizedAddress = cleanedAddress.toLowerCase();
//     if (ETHIOPIAN_LOCATIONS[normalizedAddress]) {
//       return ETHIOPIAN_LOCATIONS[normalizedAddress];
//     }

//     const ethiopiaQuery = cleanedAddress.includes("Ethiopia")
//       ? cleanedAddress
//       : `${cleanedAddress}, Ethiopia`;

//     const response = await axios.get(
//       `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ethiopiaQuery)}&countrycodes=et&limit=1`
//     );

//     if (response.data?.length > 0) {
//       const result = response.data[0];
//       const lat = parseFloat(result.lat);
//       const lon = parseFloat(result.lon);

//       if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
//         return { lat, lng: lon };
//       }
//     }

//     const components = cleanedAddress.split(",").map((c) => c.trim());
//     for (let i = 0; i < components.length; i++) {
//       const partialQuery = `${components.slice(i).join(", ")}, Ethiopia`;
//       const fallbackResponse = await axios.get(
//         `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(partialQuery)}&countrycodes=et&limit=1`
//       );

//       if (fallbackResponse.data?.length > 0) {
//         const result = fallbackResponse.data[0];
//         const lat = parseFloat(result.lat);
//         const lon = parseFloat(result.lon);

//         if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
//           return { lat, lng: lon };
//         }
//       }
//     }

//     throw new Error("Address not found in Ethiopia");
//   } catch (error) {
//     console.error("Geocoding error:", error);
//     throw new Error(`Could not locate "${address}" in Ethiopia. Please try format: "Neighborhood, City, Ethiopia"`);
//   }
// };

// const getDistance = async (point1, point2) => {
//   try {
//     const response = await axios.get(
//       `http://router.project-osrm.org/route/v1/driving/${point1.lng},${point1.lat};${point2.lng},${point2.lat}?overview=false`
//     );

//     if (!response.data.routes?.[0]) {
//       throw new Error("No route found");
//     }

//     return response.data.routes[0].distance / 1000; // Convert to km
//   } catch (error) {
//     console.error("Distance calculation error:", error);
//     throw new Error("Failed to calculate distance");
//   }
// };

// // const createOrder = async (req, res) => {
// //   try {
// //     const { shippingAddress, itemsId } = req.body;
// //     const userId = req.user.id;

// //     if (!itemsId || itemsId.length === 0) {
// //       return res.status(400).json({ message: "No items selected" });
// //     }

// //     const cart = await Cart.findOne({ user: userId }).populate({
// //       path: "items.book",
// //       populate: { path: "seller", select: "name email location" },
// //     });
// //     if (!cart) {
// //       return res.status(404).json({ message: "Cart not found for this user" });
// //     }

// //     const selectedItems = cart.items.filter((item) =>
// //       itemsId.includes(item.book._id.toString())
// //     );
// //     if (selectedItems.length === 0) {
// //       return res.status(400).json({ message: "No valid items selected from the cart" });
// //     }

// //     const hasPhysicalItems = selectedItems.some((item) => !item.book.isDigital);

// //     // Require shippingAddress only for orders with physical items
// //     if (hasPhysicalItems && !shippingAddress) {
// //       return res.status(400).json({ message: "Shipping address required for physical items" });
// //     }

// //     const existingOrder = await Order.findOne({
// //       user: userId,
// //       "items.book": { $all: itemsId },
// //       paymentStatus: { $in: ["pending", "completed"] },
// //     });
// //     if (existingOrder) {
// //       const existingItemsMap = new Map(
// //         existingOrder.items.map((item) => [item.book._id.toString(), item.quantity])
// //       );
// //       const isRedundant = selectedItems.every(
// //         (newItem) => existingItemsMap.get(newItem.book._id.toString()) === newItem.quantity
// //       );
// //       if (isRedundant) {
// //         return res.status(400).json({
// //           message: "This order has already been placed",
// //           existingOrderId: existingOrder._id,
// //         });
// //       }
// //     }

// //     const sellerGroups = new Map();
// //     selectedItems.forEach((item) => {
// //       const sellerId = item.book.seller._id.toString();
// //       if (!sellerGroups.has(sellerId)) {
// //         const hasValidLocation =
// //           item.book.seller.location &&
// //           item.book.seller.location.coordinates &&
// //           typeof item.book.seller.location.coordinates.lat === "number" &&
// //           typeof item.book.seller.location.coordinates.lng === "number";
// //         sellerGroups.set(sellerId, {
// //           seller: item.book.seller,
// //           physicalItems: [],
// //           digitalItems: [],
// //           subtotal: 0,
// //           hasValidLocation,
// //           sellerLocation: hasValidLocation
// //             ? { lat: item.book.seller.location.coordinates.lat, lng: item.book.seller.location.coordinates.lng }
// //             : null,
// //         });
// //       }

// //       const sellerGroup = sellerGroups.get(sellerId);
// //       const orderItem = {
// //         book: item.book._id,
// //         quantity: item.quantity,
// //         price: item.book.price,
// //         seller: sellerId,
// //         isDigital: item.book.isDigital,
// //       };

// //       if (item.book.isDigital) {
// //         sellerGroup.digitalItems.push(orderItem);
// //       } else {
// //         sellerGroup.physicalItems.push(orderItem);
// //       }
// //       sellerGroup.subtotal += orderItem.price * orderItem.quantity;
// //     });

// //     const sellerGroupsArray = Array.from(sellerGroups.values());
// //     let shippingCoords = null;

// //     // Only perform geocoding and distance calculation if there are physical items
// //     if (hasPhysicalItems) {
// //       try {
// //         const geocoded = await geocodeAddress(shippingAddress);
// //         shippingCoords = [geocoded.lng, geocoded.lat];
// //       } catch (geocodeError) {
// //         console.error("Geocoding failed:", geocodeError.message);
// //         shippingCoords = [38.7636, 9.0054]; // Default coordinates
// //       }
// //     }

// //     await Promise.all(
// //       sellerGroupsArray.map(async (group) => {
// //         if (group.physicalItems.length > 0) {
// //           if (!group.hasValidLocation || !group.sellerLocation) {
// //             group.deliveryFee = 100;
// //             group.distance = null;
// //             group.fromLocation = {
// //               type: "Point",
// //               coordinates: [38.7636, 9.0054],
// //               note: "Default location used",
// //             };
// //           } else {
// //             try {
// //               const distance = await getDistance(group.sellerLocation, {
// //                 lat: shippingCoords[1],
// //                 lng: shippingCoords[0],
// //               });
// //               group.deliveryFee = Math.max(50, Math.min(distance * 10, 500));
// //               group.distance = distance;
// //               group.fromLocation = {
// //                 type: "Point",
// //                 coordinates: [group.sellerLocation.lng, group.sellerLocation.lat],
// //               };
// //             } catch (error) {
// //               console.error(`Delivery calculation failed for seller ${group.seller._id}:`, error.message);
// //               group.deliveryFee = 100;
// //               group.distance = null;
// //               group.fromLocation = {
// //                 type: "Point",
// //                 coordinates: [38.7636, 9.0054],
// //                 note: "Default location used",
// //               };
// //             }
// //           }
// //         } else {
// //           group.deliveryFee = 0;
// //           group.distance = null;
// //           group.fromLocation = null;
// //         }
// //         group.total = group.subtotal + (group.deliveryFee || 0);
// //       })
// //     );

// //     const allOrderItems = sellerGroupsArray.flatMap((group) => [
// //       ...group.physicalItems,
// //       ...group.digitalItems,
// //     ]);

// //     const order = new Order({
// //       user: userId,
// //       cart: cart._id,
// //       items: allOrderItems,
// //       pricing: {
// //         subtotal: sellerGroupsArray.reduce((sum, g) => sum + g.subtotal, 0),
// //         deliveryFee: sellerGroupsArray.reduce((sum, g) => sum + (g.deliveryFee || 0), 0),
// //         total: sellerGroupsArray.reduce((sum, g) => sum + g.total, 0),
// //         sellerBreakdown: sellerGroupsArray.map((group) => ({
// //           seller: group.seller._id,
// //           subtotal: group.subtotal,
// //           deliveryFee: group.deliveryFee || 0,
// //           total: group.total,
// //           distance: group.distance,
// //           fromLocation: group.fromLocation,
// //           toLocation: group.physicalItems.length > 0 ? { type: "Point", coordinates: shippingCoords } : null,
// //         })),
// //       },
// //       shippingAddress: hasPhysicalItems ? shippingAddress : null, // Only set if physical items exist
// //       shippingLocation: hasPhysicalItems ? { type: "Point", coordinates: shippingCoords } : null, // Only set if physical items exist
// //       paymentStatus: "pending",
// //       txRef: `order-${userId}-${Date.now()}`,
// //     });

// //     await order.save();

// //     const paymentData = {
// //       amount: order.pricing.total.toString(),
// //       currency: "ETB",
// //       email: req.user.email || "customer@example.com",
// //       first_name: req.user.name?.split(" ")[0] || "Customer",
// //       last_name: req.user.name?.split(" ")[1] || "User",
// //       tx_ref: order.txRef,
// //       callback_url:
// //         process.env.NODE_ENV === "production"
// //           ? `https://bookcompass.onrender.com/api/order/payment-callback?tx_ref=${order.txRef}`
// //           : `http://localhost:5000/api/order/payment-callback?tx_ref=${order.txRef}`,
// //       return_url:
// //         process.env.NODE_ENV === "production"
// //           ? `https://bookcompass.onrender.com/api/order/payment-success?tx_ref=${order.txRef}`
// //           : `http://localhost:5000/api/order/payment-success?tx_ref=${order.txRef}`,
// //       "customization[title]": "Book Order Payment",
// //       "customization[description]": `Payment for order #${order._id}`,
// //     };

// //     const response = await axios.post(CHAPA_API_URL, paymentData, {
// //       headers: {
// //         Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
// //         "Content-Type": "application/json",
// //       },
// //     });

// //     if (response.data.status === "success") {
// //       cart.items = cart.items.filter((item) => !itemsId.includes(item.book._id.toString()));
// //       cart.totalPrice = cart.items.reduce(
// //         (total, item) => (item.book?.price ? total + item.quantity * item.book.price : total),
// //         0
// //       );
// //       await cart.save();

// //       return res.status(200).json({
// //         order,
// //         checkoutUrl: response.data.data.checkout_url,
// //         txRef: order.txRef,
// //       });
// //     } else {
// //       throw new Error("Payment initiation failed");
// //     }
// //   } catch (error) {
// //     console.error("Order creation failed:", error);
// //     res.status(400).json({
// //       error: error.message,
// //       details: process.env.NODE_ENV === "development" ? error.stack : undefined,
// //     });
// //   }
// // };



// const createOrder = async (req, res) => {
//   try {
//     const { shippingAddress, itemsId } = req.body;
//     const userId = req.user.id;

//     if (!itemsId || itemsId.length === 0) {
//       return res.status(400).json({ message: "No items selected" });
//     }

//     const cart = await Cart.findOne({ user: userId }).populate({
//       path: "items.book",
//       populate: { path: "seller", select: "name email location" },
//     });
//     if (!cart) {
//       return res.status(404).json({ message: "Cart not found for this user" });
//     }

//     const selectedItems = cart.items.filter((item) =>
//       itemsId.includes(item.book._id.toString())
//     );
//     if (selectedItems.length === 0) {
//       return res.status(400).json({ message: "No valid items selected from the cart" });
//     }

//     const hasPhysicalItems = selectedItems.some((item) => !item.book.isDigital && !item.book.isAudiobook);

//     if (hasPhysicalItems && !shippingAddress) {
//       return res.status(400).json({ message: "Shipping address required for physical items" });
//     }

//     const existingOrder = await Order.findOne({
//       user: userId,
//       "items.book": { $all: itemsId },
//       paymentStatus: { $in: ["pending", "completed"] },
//     });
//     if (existingOrder) {
//       const existingItemsMap = new Map(
//         existingOrder.items.map((item) => [item.book._id.toString(), item.quantity])
//       );
//       const isRedundant = selectedItems.every(
//         (newItem) => existingItemsMap.get(newItem.book._id.toString()) === newItem.quantity
//       );
//       if (isRedundant) {
//         return res.status(400).json({
//           message: "This order has already been placed",
//           existingOrderId: existingOrder._id,
//         });
//       }
//     }

//     const sellerGroups = new Map();
//     selectedItems.forEach((item) => {
//       const sellerId = item.book.seller._id.toString();
//       if (!sellerGroups.has(sellerId)) {
//         const hasValidLocation =
//           item.book.seller.location &&
//           item.book.seller.location.coordinates &&
//           typeof item.book.seller.location.coordinates.lat === "number" &&
//           typeof item.book.seller.location.coordinates.lng === "number";
//         sellerGroups.set(sellerId, {
//           seller: item.book.seller,
//           physicalItems: [],
//           digitalItems: [],
//           audiobookItems: [],
//           subtotal: 0,
//           hasValidLocation,
//           sellerLocation: hasValidLocation
//             ? { lat: item.book.seller.location.coordinates.lat, lng: item.book.seller.location.coordinates.lng }
//             : null,
//         });
//       }

//       const sellerGroup = sellerGroups.get(sellerId);
//       const orderItem = {
//         book: item.book._id,
//         quantity: item.quantity,
//         price: item.book.price,
//         seller: sellerId,
//         isDigital: item.book.isDigital,
//         isAudiobook: item.book.isAudiobook,
//       };

//       if (item.book.isAudiobook) {
//         sellerGroup.audiobookItems.push(orderItem);
//       } else if (item.book.isDigital) {
//         sellerGroup.digitalItems.push(orderItem);
//       } else {
//         sellerGroup.physicalItems.push(orderItem);
//       }
//       sellerGroup.subtotal += orderItem.price * orderItem.quantity;
//     });

//     const sellerGroupsArray = Array.from(sellerGroups.values());
//     let shippingCoords = null;

//     if (hasPhysicalItems) {
//       try {
//         const geocoded = await geocodeAddress(shippingAddress);
//         shippingCoords = [geocoded.lng, geocoded.lat];
//       } catch (geocodeError) {
//         console.error("Geocoding failed:", geocodeError.message);
//         shippingCoords = [38.7636, 9.0054];
//       }
//     }

//     await Promise.all(
//       sellerGroupsArray.map(async (group) => {
//         if (group.physicalItems.length > 0) {
//           if (!group.hasValidLocation || !group.sellerLocation) {
//             group.deliveryFee = 100;
//             group.distance = null;
//             group.fromLocation = {
//               type: "Point",
//               coordinates: [38.7636, 9.0054],
//               note: "Default location used",
//             };
//           } else {
//             try {
//               const distance = await getDistance(group.sellerLocation, {
//                 lat: shippingCoords[1],
//                 lng: shippingCoords[0],
//               });
//               group.deliveryFee = Math.max(50, Math.min(distance * 10, 500));
//               group.distance = distance;
//               group.fromLocation = {
//                 type: "Point",
//                 coordinates: [group.sellerLocation.lng, group.sellerLocation.lat],
//               };
//             } catch (error) {
//               console.error(`Delivery calculation failed for seller ${group.seller._id}:`, error.message);
//               group.deliveryFee = 100;
//               group.distance = null;
//               group.fromLocation = {
//                 type: "Point",
//                 coordinates: [38.7636, 9.0054],
//                 note: "Default location used",
//               };
//             }
//           }
//         } else {
//           group.deliveryFee = 0;
//           group.distance = null;
//           group.fromLocation = null;
//         }
//         group.total = group.subtotal + (group.deliveryFee || 0);
//       })
//     );

//     const allOrderItems = sellerGroupsArray.flatMap((group) => [
//       ...group.physicalItems,
//       ...group.digitalItems,
//       ...group.audiobookItems,
//     ]);

//     const order = new Order({
//       user: userId,
//       cart: cart._id,
//       items: allOrderItems,
//       pricing: {
//         subtotal: sellerGroupsArray.reduce((sum, g) => sum + g.subtotal, 0),
//         deliveryFee: sellerGroupsArray.reduce((sum, g) => sum + (g.deliveryFee || 0), 0),
//         total: sellerGroupsArray.reduce((sum, g) => sum + g.total, 0),
//         sellerBreakdown: sellerGroupsArray.map((group) => ({
//           seller: group.seller._id,
//           subtotal: group.subtotal,
//           deliveryFee: group.deliveryFee || 0,
//           total: group.total,
//           distance: group.distance,
//           fromLocation: group.fromLocation,
//           toLocation: group.physicalItems.length > 0 ? { type: "Point", coordinates: shippingCoords } : null,
//         })),
//       },
//       shippingAddress: hasPhysicalItems ? shippingAddress : null,
//       shippingLocation: hasPhysicalItems ? { type: "Point", coordinates: shippingCoords } : null,
//       paymentStatus: "pending",
//       txRef: `order-${userId}-${Date.now()}`,
//     });

//     await order.save();

// const paymentData = {
//       amount: order.pricing.total.toString(),
//       currency: "ETB",
//       email: req.user.email || "customer@example.com",
//       first_name: req.user.name?.split(" ")[0] || "Customer",
//       last_name: req.user.name?.split(" ")[1] || "User",
//       tx_ref: order.txRef,
//       callback_url:
//         process.env.NODE_ENV === "production"
//           ? `https://bookcompass.onrender.com/api/order/payment-callback?tx_ref=${order.txRef}`
//           : `http://localhost:5000/api/order/payment-callback?tx_ref=${order.txRef}`,
//       return_url:
//         process.env.NODE_ENV === "production"
//           ? `https://bookcompass.onrender.com/api/order/payment-success?tx_ref=${order.txRef}`
//           : `http://localhost:5000/api/order/payment-success?tx_ref=${order.txRef}`,
//       "customization[title]": "Book Order Payment",
//       "customization[description]": `Payment for order #${order._id}`,
//     };

//     const response = await axios.post(CHAPA_API_URL, paymentData, {
//       headers: {
//         Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
//         "Content-Type": "application/json",
//       },
//     });

//     if (response.data.status === "success") {
//       cart.items = cart.items.filter((item) => !itemsId.includes(item.book._id.toString()));
//       cart.totalPrice = cart.items.reduce(
//         (total, item) => (item.book?.price ? total + item.quantity * item.book.price : total),
//         0
//       );
//       await cart.save();

//       return res.status(200).json({
//         order,
//         checkoutUrl: response.data.data.checkout_url,
//         txRef: order.txRef,
//       });
//     } else {
//       throw new Error("Payment initiation failed");
//     }
//   } catch (error) {
//     console.error("Order creation failed:", error);
//     res.status(400).json({
//       error: error.message,
//       details: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };




// const verifyPayment = async (req, res) => {
//   try {
//     const { tx_ref } = req.query;
//     console.log("Received tx_ref:", tx_ref);
//     if (!tx_ref) {
//       return res.status(400).json({ message: "Transaction reference (tx_ref) is missing" });
//     }

//     // Verify the transaction with Chapa
//     const verifyUrl = `${CHAPA_VERIFY_URL}${tx_ref}`;
//     const response = await axios.get(verifyUrl, {
//       headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
//     });

//     // Log the Chapa response for debugging
//     console.log("Chapa verification response:", response.data);

//     const order = await Order.findOne({ txRef: tx_ref }).populate("items.book");
//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     if (response.data.status === "success" && response.data.data.status === "success") {
//       order.paymentStatus = "paid";
//       order.orderStatus = "processing";
//       order.transactionDetails = response.data.data;

//       // Update stock only for physical books
//       for (const item of order.items) {
//         if (!item.book.isDigital) {
//           const book = await Book.findById(item.book._id);
//           if (!book) {
//             throw new Error(`Book with ID ${item.book._id} not found`);
//           }
//           if (typeof book.stock !== "number") {
//             throw new Error(`Invalid stock value for book ${item.book._id}: ${book.stock}`);
//           }
//           await Book.findByIdAndUpdate(item.book._id, { $inc: { stock: -item.quantity } });
//         }
//       }

//       // Save the order and ensure the update is committed
//       await order.save();
//       console.log(`Order ${order._id} updated to paid status`);

//       // Verify the update by re-fetching the order
//       const updatedOrder = await Order.findById(order._id);
//       if (updatedOrder.paymentStatus !== "paid") {
//         console.error(`Order ${order._id} paymentStatus not updated, still: ${updatedOrder.paymentStatus}`);
//         throw new Error("Failed to update order payment status");
//       }

//       res.redirect(`/api/order/payment-success?tx_ref=${tx_ref}`);
//     } else {
//       order.paymentStatus = "failed";
//       await order.save();
//       console.log(`Order ${order._id} updated to failed status`);
//       res.status(400).json({ message: "Payment verification failed", details: response.data });
//     }
//   } catch (error) {
//     console.error("Error verifying payment:", error.response ? error.response.data : error.message);
//     res.status(500).json({
//       error: "Error verifying payment",
//       details: error.response ? error.response.data : error.message,
//     });
//   }
// };

// const paymentSuccess = async (req, res) => {
//   try {
//     const { tx_ref } = req.query;
//     if (!tx_ref) {
//       return res.status(400).json({ message: "Transaction reference (tx_ref) is missing" });
//     }

//     // Retry mechanism to handle potential race conditions
//     let order;
//     let attempts = 0;
//     const maxAttempts = 3;
//     const delay = 500; // 500ms delay between retries

//     while (attempts < maxAttempts) {
//       order = await Order.findOne({ txRef: tx_ref })
//         .populate("items.book")
//         .populate("items.seller");

//       if (order && order.paymentStatus === "paid") {
//         break; // Success, exit the loop
//       }

//       console.log(`Attempt ${attempts + 1}: Order ${order?._id} paymentStatus is ${order?.paymentStatus}, retrying...`);
//       await new Promise((resolve) => setTimeout(resolve, delay));
//       attempts++;
//     }

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     if (order.paymentStatus === "paid") {
//       // Construct the Chapa receipt URL
//       const chapaReceiptUrl = `https://checkout.chapa.co/checkout/${
//         order.transactionDetails.mode === "test" ? "test-" : ""
//       }payment-receipt/${order.transactionDetails.reference}`;

//       res.status(200).json({
//         message: "Payment successful!",
//         orderDetails: {
//           items: order.items.map((item) => ({
//             bookTitle: item.book.title,
//             price: item.price,
//             quantity: item.quantity,
//             sellerName: item.seller.name,
//             isDigital: item.book.isDigital, // Include isDigital to help the front-end
//             accessUrl: item.book.isDigital
//               ? `${req.protocol}://${req.get("host")}/api/order/stream/${item.book._id}`
//               : null, // Provide a secure access URL for digital books
//           })),
//           pricing: {
//             subtotal: order.pricing.subtotal,
//             deliveryFee: order.pricing.deliveryFee,
//             total: order.pricing.total,
//           },
//         },
//         paymentDetails: {
//           amount: order.transactionDetails.amount,
//           currency: order.transactionDetails.currency,
//           charge: order.transactionDetails.charge,
//           status: order.transactionDetails.status,
//           reference: order.transactionDetails.reference,
//           date: order.transactionDetails.created_at,
//           receiptUrl: chapaReceiptUrl,
//         },
//       });
//     } else {
//       console.log(`Payment not completed for order ${order._id}, status: ${order.paymentStatus}`);
//       res.status(400).json({
//         message: "Payment not completed",
//         orderStatus: order.paymentStatus,
//       });
//     }
//   } catch (error) {
//     console.error("Error in paymentSuccess:", error.response ? error.response.data : error.message);
//     res.status(500).json({
//       error: "Error retrieving transaction details",
//       details: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };


// // const streamDigitalBook = async (req, res) => {
// //   try {
// //     const bookId = req.params.bookId;
// //     const userId = req.user.id;
// //     const download = req.query.download === "true";

// //     const book = await Book.findById(bookId);
// //     if (!book || !book.isDigital || !book.fileUrl) {
// //       return res.status(404).json({ error: "Digital book not found" });
// //     }

// //     const order = await Order.findOne({
// //       user: userId,
// //       "items.book": bookId,
// //       paymentStatus: "paid",
// //     });

// //     if (!order) {
// //       return res.status(403).json({ error: "You do not have access to this digital book" });
// //     }

// //     const response = await axios({
// //       url: book.fileUrl,
// //       method: "GET",
// //       responseType: "stream",
// //     });

// //     // Log the upstream Content-Type for debugging
// //     console.log("Upstream Content-Type:", response.headers["content-type"]);

// //     // Sanitize the book title for use in filenames
// //     const sanitizeFilename = (title) => {
// //       return title
// //         .trim()
// //         .replace(/[^a-zA-Z0-9\s-]/g, "")
// //         .replace(/\s+/g, "_")
// //         .toLowerCase();
// //     };
// //     const filename = `${sanitizeFilename(book.title)}.pdf`;

// //     // Set headers explicitly
// //     res.setHeader("Content-Type", "application/pdf");
// //     res.setHeader(
// //       "Content-Disposition",
// //       download
// //         ? `attachment; filename="${filename}"`
// //         : `inline; filename="${filename}"`
// //     );
// //     res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
// //     res.setHeader("Pragma", "no-cache");
// //     res.setHeader("Expires", "0");

// //     // Pipe the stream to the response
// //     response.data.pipe(res);

// //     // Log the final Content-Type to confirm
// //     console.log("Final Content-Type:", res.getHeader("Content-Type"));
// //   } catch (error) {
// //     console.error("Error streaming digital book:", error);
// //     res.status(500).json({ error: error.message });
// //   }
// // };

// const getOrder = async (req, res) => {
//   const isSeller = req.user.role === "seller";
//   const userId = req.user.id;

//   try {
//     if (!isSeller) {
//       const userOrders = await Order.find({ user: userId })
//         .populate("user", "name email")
//         .populate("items.book");

//       if (!userOrders || userOrders.length === 0) {
//         return res.status(404).json({ error: "No orders found for this user" });
//       }

//       return res.status(200).json({ success: true, data: userOrders });
//     }

//     const sellerBooks = await Book.find({ seller: userId }).select("_id");

//     if (sellerBooks.length === 0) {
//       return res.status(404).json({ error: "No books found for this seller" });
//     }

//     const bookIds = sellerBooks.map((book) => book._id);

//     const sellerOrders = await Order.find({ "items.book": { $in: bookIds } })
//       .populate("user", "name email")
//       .populate("items.book", "title price isDigital");

//     if (sellerOrders.length === 0) {
//       return res.status(404).json({ error: "No orders found for this seller" });
//     }

//     return res.status(200).json({ success: true, data: sellerOrders });
//   } catch (error) {
//     console.error("Error in getOrders:", error);
//     res.status(400).json({ error: error.message });
//   }
// };

// const getSingleOrder = async (req, res) => {
//   const isSeller = req.user.role === "seller";
//   const sellerId = req.user.id;
//   const { id } = req.params;
//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid Order ID format" });
//     }
//     if (!isSeller) {
//       const userSingleOrder = await Order.findOne({ _id: id, user: req.user.id });
//       if (!userSingleOrder) {
//         return res.status(404).json({ message: "Order not found" });
//       }
//       return res.status(200).json(userSingleOrder);
//     }

//     const sellerBooks = await Book.find({ seller: sellerId }).select("_id");
//     const bookIds = sellerBooks.map((book) => book._id);
//     if (bookIds.length === 0) {
//       return res.status(404).json({ error: "Seller has no books, no associated orders" });
//     }

//     const singleOrders = await Order.findOne({ _id: id, "items.book": { $in: bookIds } })
//       .populate("user", "name email")
//       .populate("items.book", "title price isDigital");
//     if (!singleOrders) {
//       return res.status(404).json({ error: "Order not found or not associated with seller" });
//     }
//     return res.status(200).json(singleOrders);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// const updateOrderStatus = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const { status } = req.body;

//     const validStatus = ["processing", "shipped", "delivered", "canceled"];
//     if (!validStatus.includes(status)) {
//       return res.status(404).json({ message: "Not a valid status" });
//     }

//     const updatedOrderStatus = await Order.findByIdAndUpdate(
//       id,
//       { orderStatus: status },
//       { new: true, setValidators: true }
//     );
//     if (!updatedOrderStatus) {
//       return res.status(404).json({ error: "Order not found." });
//     }
//     return res.status(200).json(updatedOrderStatus);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// const cancelOrder = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const user = req.user.id;

//     const order = await Order.findOne({ _id: id, user });
//     if (!order) {
//       return res.status(404).json({ error: "Order not found." });
//     }

//     if (order.orderStatus !== "processing") {
//       return res.status(400).json({ error: "Order cannot be canceled." });
//     }
//     order.orderStatus = "canceled";

//     await order.save();

//     for (const item of order.items) {
//       if (!item.isDigital) {
//         await Book.findByIdAndUpdate(item.book, { $inc: { stock: item.quantity } });
//       }
//     }
//     res.status(200).json({ success: true, data: order });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// const deleteOrder = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid Order ID format" });
//     }

//     const order = await Order.findByIdAndDelete({ _id: id });

//     if (!order) {
//       return res.status(404).json({ error: "Order not found." });
//     }

//     res.status(200).json({ success: true, message: "Order deleted successfully." });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const getOrderReports = async (req, res) => {
//   const isSeller = req.user.role === "seller";
//   const sellerId = req.user.id;
//   try {
//     if (req.user.role === "seller") {
//       const sellerBooks = await Book.find({ seller: req.user.id }).select("_id");

//       if (sellerBooks.length === 0) {
//         return res.status(404).json({ error: "No books found for this seller." });
//       }

//       const bookIds = sellerBooks.map((book) => book._id);

//       const orders = await Order.aggregate([
//         { $match: { "items.book": { $in: bookIds } } },
//         {
//           $group: {
//             _id: "$orderStatus",
//             count: { $sum: 1 },
//             totalRevenue: { $sum: "$pricing.total" },
//           },
//         },
//       ]);

//       res.status(200).json({ success: true, data: orders });
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// module.exports = {
//   createOrder,
//   getOrder,
//   getSingleOrder,
//   updateOrderStatus,
//   deleteOrder,
//   cancelOrder,
//   getOrderReports,
//   verifyPayment,
//   paymentSuccess,
//   // streamDigitalBook,
// };




















































const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const Book = require("../models/bookModel");
const User = require("../models/userModel");
const axios = require("axios");
const sendEmail = require("../utils/sendEmail");
require("dotenv").config();
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
const CHAPA_API_URL = "https://api.chapa.co/v1/transaction/initialize";
const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify/";

const geocodeAddress = async (address) => {
  try {
    const cleanedAddress = address
      .replace(/,+/g, ", ")
      .replace(/\s+/g, " ")
      .trim();

    const ETHIOPIAN_LOCATIONS = {
      mexico: { lat: 9.001442, lng: 38.6771697 },
      "mexico, addis ababa": { lat: 9.001442, lng: 38.6771697 },
      bole: { lat: 8.9806, lng: 38.7998 },
      piassa: { lat: 9.0300, lng: 38.7500 },
    };

    const normalizedAddress = cleanedAddress.toLowerCase();
    if (ETHIOPIAN_LOCATIONS[normalizedAddress]) {
      return ETHIOPIAN_LOCATIONS[normalizedAddress];
    }

    const ethiopiaQuery = cleanedAddress.includes("Ethiopia")
      ? cleanedAddress
      : `${cleanedAddress}, Ethiopia`;

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ethiopiaQuery)}&countrycodes=et&limit=1`
    );

    if (response.data?.length > 0) {
      const result = response.data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
        return { lat, lng: lon };
      }
    }

    const components = cleanedAddress.split(",").map((c) => c.trim());
    for (let i = 0; i < components.length; i++) {
      const partialQuery = `${components.slice(i).join(", ")}, Ethiopia`;
      const fallbackResponse = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(partialQuery)}&countrycodes=et&limit=1`
      );

      if (fallbackResponse.data?.length > 0) {
        const result = fallbackResponse.data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
          return { lat, lng: lon };
        }
      }
    }

    throw new Error("Address not found in Ethiopia");
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error(`Could not locate "${address}" in Ethiopia. Please try format: "Neighborhood, City, Ethiopia"`);
  }
};

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
      populate: { path: "seller", select: "name email location" },
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
      return res.status(400).json({ message: "Shipping address required for physical items" });
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
          item.book.seller.location &&
          item.book.seller.location.coordinates &&
          typeof item.book.seller.location.coordinates.lat === "number" &&
          typeof item.book.seller.location.coordinates.lng === "number";
        sellerGroups.set(sellerId, {
          seller: item.book.seller,
          physicalItems: [],
          digitalItems: [],
          audiobookItems: [],
          subtotal: 0,
          hasValidLocation,
          sellerLocation: hasValidLocation
            ? { lat: item.book.seller.location.coordinates.lat, lng: item.book.seller.location.coordinates.lng }
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
        shippingCoords = [geocoded.lng, geocoded.lat];
      } catch (geocodeError) {
        console.error("Geocoding failed:", geocodeError.message);
        shippingCoords = [38.7636, 9.0054];
      }
    }

    await Promise.all(
      sellerGroupsArray.map(async (group) => {
        if (group.physicalItems.length > 0) {
          if (!group.hasValidLocation || !group.sellerLocation) {
            group.deliveryFee = 100;
            group.distance = null;
            group.fromLocation = {
              type: "Point",
              coordinates: [38.7636, 9.0054],
              note: "Default location used",
            };
          } else {
            try {
              const distance = await getDistance(group.sellerLocation, {
                lat: shippingCoords[1],
                lng: shippingCoords[0],
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

// const updateOrderStatus = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const { status } = req.body;

//     const validStatus = ["processing", "shipped", "delivered", "canceled"];
//     if (!validStatus.includes(status)) {
//       return res.status(404).json({ message: "Not a valid status" });
//     }

//     const updatedOrderStatus = await Order.findByIdAndUpdate(
//       id,
//       { orderStatus: status },
//       { new: true, setValidators: true }
//     );
//     if (!updatedOrderStatus) {
//       return res.status(404).json({ error: "Order not found." });
//     }
//     return res.status(200).json(updatedOrderStatus);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// const cancelOrder = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const user = req.user.id;

//     const order = await Order.findOne({ _id: id, user });
//     if (!order) {
//       return res.status(404).json({ error: "Order not found." });
//     }

//     if (order.orderStatus !== "processing") {
//       return res.status(400).json({ error: "Order cannot be canceled." });
//     }
//     order.orderStatus = "canceled";

//     await order.save();

//     for (const item of order.items) {
//       if (!item.isDigital && !item.isAudiobook) {
//         await Book.findByIdAndUpdate(item.book, { $inc: { stock: item.quantity } });
//       }
//     }
//     res.status(200).json({ success: true, data: order });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };


const updateOrderStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatus = ["processing", "shipped", "delivered", "canceled"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    // Additional check for sellers (can only update their own items)
    if (req.user.role === "seller") {
      const sellerBooks = await Book.find({ seller: userId }).select("_id");
      const bookIds = sellerBooks.map(book => book._id);
      const hasItems = order.items.some(item => bookIds.includes(item.book));
      
      if (!hasItems) {
        return res.status(403).json({ error: "Not authorized to update this order" });
      }
    }

    // Validate status transition
    if (!isValidTransition(order.orderStatus, status)) {
      return res.status(400).json({ 
        error: `Cannot change status from ${order.orderStatus} to ${status}`
      });
    }

    // Special handling for cancellation
    if (status === "canceled") {
      if (order.orderStatus !== "processing") {
        return res.status(400).json({ 
          error: "Only processing orders can be canceled"
        });
      }
      
      // Restock items
      for (const item of order.items) {
        if (!item.isDigital && !item.isAudiobook) {
          await Book.findByIdAndUpdate(item.book, { 
            $inc: { stock: item.quantity } 
          });
        }
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { orderStatus: status },
      { new: true }
    );

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};



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
