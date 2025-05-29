// // utils/multer.js
// const multer = require("multer");
// const path = require("path");

// const storage = multer.memoryStorage();

// // File filter to allow specific file types
// const fileFilter = (req, file, cb) => {
//   const isDigital = req.body.isDigital === "true" || req.body.isDigital === true;
//   const imageTypes = [".jpg", ".jpeg", ".png", ".gif"];
//   const digitalTypes = [".pdf", ".epub", ".mp3"];
//   const fileExtension = path.extname(file.originalname).toLowerCase();

//   if (isDigital) {
//     if (digitalTypes.includes(fileExtension)) {
//       cb(null, true);
//     } else {
//       cb(new Error("Invalid file type. Allowed types: PDF, EPUB, MP3"), false);
//     }
//   } else {
//     if (imageTypes.includes(fileExtension)) {
//       cb(null, true);
//     } else {
//       cb(new Error("Invalid file type. Only images (JPG, PNG, GIF) are allowed"), false);
//     }
//   }
// };

// // Initialize Multer
// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 100 * 1024 * 1024, // 100MB
//   },
// });

// module.exports = upload;










// utils/multer.js
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

// File filter to allow specific file types
const fileFilter = (req, file, cb) => {
    const imageTypes = [".jpg", ".jpeg", ".png", ".gif"];
    const digitalTypes = [".pdf", ".epub", ".mp3"];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Handle profile image uploads
    if (file.fieldname === "profileImage") {
        if (imageTypes.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid profile image type. Only JPG, PNG, GIF are allowed"), false);
        }
    }
    // Handle book uploads
    else if (file.fieldname === "image" || file.fieldname === "file") {
        const isDigital = req.body.isDigital === "true" || req.body.isDigital === true;
        
        if (file.fieldname === "image") {
            if (imageTypes.includes(fileExtension)) {
                cb(null, true);
            } else {
                cb(new Error("Invalid image type. Only JPG, PNG, GIF are allowed"), false);
            }
        } else if (file.fieldname === "file") {
            if (digitalTypes.includes(fileExtension)) {
                cb(null, true);
            } else {
                cb(new Error("Invalid file type for digital or audio book. Allowed types: PDF, EPUB, MP3"), false);
            }
        }
    } else {
        cb(new Error("Unknown field name"), false);
    }
};

// Create separate upload instances for different purposes
const profileUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB for profile images
    },
});

const bookUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB for books
    },
});

module.exports = {
    profileUpload,
    bookUpload
};
