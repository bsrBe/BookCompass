const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage()

// File filter to allow only specific file types (e.g., images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [".jpg", ".jpeg", ".png", ".gif"];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(fileExtension)) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error("Invalid file type. Only images are allowed."), false); // Reject the file
  }
};

// Initialize Multer with the configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    limits: { fileSize: 10 * 1024 * 1024 },
  },
});

module.exports = upload;