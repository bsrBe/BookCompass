// db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;  // Fetch the URI from environment variables
    if (!uri) {
      throw new Error("MongoDB URI not found in environment variables.");
    }
    await mongoose.connect(uri, {});
    console.log("Connected to MongoDb successfully");
  } catch (err) {
    console.error("Error Connecting to the database", err);
    process.exit(1); // Exit the process if connection fails
  }
};

module.exports = connectDB;
