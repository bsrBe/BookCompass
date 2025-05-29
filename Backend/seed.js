// test/seed.js
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Book = require("../models/bookModel");
const User = require("../models/userModel");

require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const seedData = async () => {
  try {
    const user = await User.findOne({ email: "test@example.com" }) || await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123", // Hash in production
      role: "buyer",
    });

    const book = await Book.findOne({ title: "Test Digital Book" }) || await Book.create({
      title: "Test Digital Book",
      price: 10,
      seller: new mongoose.Types.ObjectId(), // Replace with real seller ID
      isDigital: true,
      fileUrl: "https://res.cloudinary.com/del8nxbgd/image/upload/v1743418261/digital_books/ker6iumsisyg8uycrowi.pdf",
    });

    const order = await Order.create({
      user: user._id,
      items: [{
        book: book._id,
        quantity: 1,
        price: 10,
        seller: book.seller,
        isDigital: true,
      }],
      pricing: { subtotal: 10, deliveryFee: 0, total: 10 },
      paymentStatus: "pending", // Will be updated to "paid" later
      txRef: `order-${user._id}-${Date.now()}`,
    });

    console.log("Seeded:", { userId: user._id, bookId: book._id, orderId: order._id, txRef: order.txRef });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
};

seedData();