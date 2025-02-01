require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;
const path = require("path");
const { Readable } = require("stream");
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
});

/**
 * Uploads an image to Cloudinary.
 * @param {string} imagePath - The path to the image file on the local machine.
 * @returns {Promise<string>} - The public ID of the uploaded image.
 */
const uploadImage = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "product_images" }, // Optional: Organize images in a folder
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    // Convert buffer to a readable stream
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null); // Signal end of stream
    readableStream.pipe(uploadStream);
  });
};

module.exports = { uploadImage };