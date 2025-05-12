const User = require("../models/userModel");
const Book = require("../models/bookModel");
const Order = require("../models/orderModel"); // Import Order model
const { Settings, getSettings } = require("../models/settingsModel"); // Import Settings model
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { uploadImage, uploadFile, cloudinary } = require("../utils/cloudinary"); // Added uploadFile and cloudinary imports

const getDashboardOverview = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSellers = await User.countDocuments({ role: "seller" });
    const totalBuyers = await User.countDocuments({ role: "buyer" });
    const totalProducts = await Book.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Find orders with digital or audio books, group by user, and count distinct users
    const digitalAudioOrders = await Order.aggregate([
      { $unwind: "$items" }, // Deconstruct the items array
      {
        $lookup: { // Join with the books collection
          from: "books",
          localField: "items.book",
          foreignField: "_id",
          as: "bookDetails"
        }
      },
      { $unwind: "$bookDetails" }, // Deconstruct the bookDetails array
      {
        $match: { // Filter for orders containing digital or audio books
          $or: [
            { "bookDetails.isDigital": true },
            { "bookDetails.isAudiobook": true }
          ]
        }
      },
      {
        $group: { // Group by user to get unique users
          _id: "$user"
        }
      },
      {
        $count: "totalDigitalAudioBuyers" // Count the number of unique users
      }
    ]);

    const totalDigitalAudioBuyers = digitalAudioOrders.length > 0 ? digitalAudioOrders[0].totalDigitalAudioBuyers : 0;


    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalSellers,
        totalBuyers,
        totalProducts,
        totalOrders, // Add total orders
        totalDigitalAudioBuyers, // Add total digital/audio buyers
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("name email role isEmailConfirmed createdAt");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const user = await User.findById(id).select("name email role location profileImageUrl isEmailConfirmed createdAt");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, location, profileImageUrl } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "buyer",
      location: role === "seller" ? { address: location?.address } : undefined,
      profileImageUrl: profileImageUrl || "https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp",
      isEmailConfirmed: true, // Admins can create confirmed users
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.isEmailConfirmed = false; // Blocking by disabling email confirmation
    await user.save();
    res.status(200).json({ success: true, message: "User blocked successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.isEmailConfirmed = true; // Unblocking by enabling email confirmation
    await user.save();
    res.status(200).json({ success: true, message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const books = await Book.find()
      .populate("seller", "name email")
      .select("title author price category isDigital isAudiobook imageUrl");
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      title,
      author,
      description,
      price,
      stock,
      category,
      isbn,
      isDigital,
      isAudiobook,
      sellerId,
    } = req.body;

    const isDigitalBook = isDigital === "true" || isDigital === true;
    const isAudiobookBook = isAudiobook === "true" || isAudiobook === true;

    if (!title || !author || !price || !category || !isbn || !sellerId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (isDigitalBook && isAudiobookBook) {
      return res.status(400).json({ error: "A book cannot be both digital and audiobook" });
    }

    let imageUrl = "https://via.placeholder.com/150";
    let fileUrl = null;

    if (isDigitalBook || isAudiobookBook) {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: "No file provided for digital book or audiobook" });
      }
      const file = req.files.file[0];
      fileUrl = await uploadFile(file.buffer, {
        resource_type: isAudiobookBook ? "video" : "raw",
        folder: isAudiobookBook ? "audiobooks" : "digital_books",
      });

      if (req.files && req.files.image) {
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }
    } else {
      if (!stock || isNaN(stock) || parseInt(stock) < 0) {
        return res.status(400).json({ error: "Stock is required for physical books and must be a non-negative number" });
      }
      if (req.files && req.files.image) {
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }
    }

    const book = await Book.create({
      title,
      author,
      description,
      price: parseFloat(price),
      stock: isDigitalBook || isAudiobookBook ? null : parseInt(stock),
      category,
      imageUrl,
      seller: sellerId,
      isbn,
      isDigital: isDigitalBook,
      isAudiobook: isAudiobookBook,
      fileUrl: isDigitalBook || isAudiobookBook ? fileUrl : undefined,
    });

    res.status(201).json({ success: true, data: book });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    const {
      title,
      author,
      description,
      price,
      stock,
      category,
      isbn,
      isDigital,
      isAudiobook,
    } = req.body;

    const isDigitalBook = isDigital === "true" || isDigital === true;
    const isAudiobookBook = isAudiobook === "true" || isAudiobook === true;

    let imageUrl = book.imageUrl; // Fixed missing property access
    let fileUrl = book.fileUrl; // Fixed indentation

    if (isDigitalBook || isAudiobookBook) {
      if (req.files && req.files.file) {
        const file = req.files.file[0];
        fileUrl = await uploadFile(file.buffer, {
          resource_type: isAudiobookBook ? "video" : "raw",
          folder: isAudiobookBook ? "audiobooks" : "digital_books",
        });
      }
      if (req.files && req.files.image) {
        if (imageUrl && !imageUrl.includes("via.placeholder.com")) {
          const publicId = imageUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }
    } else {
      if (stock && (isNaN(stock) || parseInt(stock) < 0)) {
        return res.status(400).json({ error: "Stock must be a non-negative number" });
      }
      if (req.files && req.files.image) {
        if (imageUrl && !imageUrl.includes("via.placeholder.com")) {
          const publicId = imageUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`product_images/${publicId}`);
        }
        const imageFile = req.files.image[0];
        imageUrl = await uploadImage(imageFile.buffer);
      }
    }

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      {
        title,
        author,
        description,
        price: price ? parseFloat(price) : book.price,
        stock: isDigitalBook || isAudiobookBook ? null : (stock || book.stock),
        category,
        imageUrl,
        isbn,
        isDigital: isDigitalBook,
        isAudiobook: isAudiobookBook,
        fileUrl: isDigitalBook || isAudiobookBook ? fileUrl : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!updatedBook) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.status(200).json({ success: true, data: updatedBook });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }
    const book = await Book.findByIdAndDelete(id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.status(200).json({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const admin = await User.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    admin.name = name || admin.name;
    admin.email = email || admin.email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password, salt);
    }

    await admin.save();
    res.status(200).json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleMaintenanceMode = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "Invalid 'enabled' value. Must be true or false." });
    }

    const settings = await getSettings(); // Get or create settings document
    settings.isMaintenanceMode = enabled;
    await settings.save();

    res.status(200).json({ success: true, maintenanceMode: settings.isMaintenanceMode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardOverview,
  getUsers,
  getUser,
  createUser,
  deleteUser,
  blockUser,
  unblockUser, // Added unblockUser
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateAdminProfile,
  toggleMaintenanceMode,
};
