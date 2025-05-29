// // utils/cloudinary.js
// require("dotenv").config();
// const cloudinary = require("cloudinary").v2;
// const { Readable } = require("stream");

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_SECRET_KEY,
//   secure: true,
// });

// const uploadImage = (buffer) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       { folder: "product_images" },
//       (error, result) => {
//         if (error) reject(error);
//         else resolve(result.secure_url);
//       }
//     );

//     const readableStream = new Readable();
//     readableStream.push(buffer);
//     readableStream.push(null);
//     readableStream.pipe(uploadStream);
//   });
// };

// const uploadFile = (buffer, options = {}) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       { 
//         ...options,
//         // metadata: {
//         //   "content-type": "application/pdf",
//         // },
//       },
//       (error, result) => {
//         if (error) reject(error);
//         else resolve(result.secure_url);
//       }
//     );

//     const readableStream = new Readable();
//     readableStream.push(buffer);
//     readableStream.push(null);
//     readableStream.pipe(uploadStream);
//   });
// };

// module.exports = { uploadImage, uploadFile };
















const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (buffer, folder = "product_images") => {
    try {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { 
                    resource_type: "image", 
                    folder: folder,
                    transformation: [
                        { width: 1000, height: 1000, crop: "limit" },
                        { quality: "auto" }
                    ]
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );
            stream.end(buffer);
        });
    } catch (error) {
        throw new Error("Image upload failed: " + error.message);
    }
};

const uploadFile = async (buffer, options = {}) => {
    try {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { 
                    ...options,
                    resource_type: "auto"
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );
            stream.end(buffer);
        });
    } catch (error) {
        throw new Error("File upload failed: " + error.message);
    }
};

const deleteFile = async (publicId) => {
    try {
        return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        throw new Error("File deletion failed: " + error.message);
    }
};

module.exports = { uploadImage, uploadFile, deleteFile };