const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Book = require("../models/bookModel");
const mongoose = require("mongoose");

// Create a new user
exports.createUser = async (req, res) => {
    try {
        const user = await User.create(req.body);
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all users
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get a single user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update a user by ID
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Delete a user by ID
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get user's library of purchased books
exports.getLibrary = async (req, res) => {
    try {
        const userId = req.user.id;

        const orders = await Order.find({
            user: userId,
            paymentStatus: "paid",
            orderStatus: { $ne: "canceled" },
        }).populate({
            path: "items.book",
            select: "title author imageUrl isDigital isAudiobook",
        });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No purchased books found in your library" });
        }

        const library = orders.flatMap((order) =>
            order.items
                .filter((item) => item.book) // Ensure book exists
                .map((item) => ({
                    bookId: item.book._id,
                    title: item.book.title,
                    author: item.book.author,
                    imageUrl: item.book.imageUrl,
                    isDigital: item.book.isDigital,
                    isAudiobook: item.book.isAudiobook,
                    accessUrl:
                        item.book.isDigital || item.book.isAudiobook
                            ? `${req.protocol}://${req.get("host")}/api/order/stream/${item.book._id}`
                            : null,
                    purchasedAt: order.createdAt,
                }))
        );

        res.status(200).json({ success: true, data: library });
    } catch (error) {
        console.error("Error fetching library:", error);
        res.status(500).json({ error: error.message });
    }
};