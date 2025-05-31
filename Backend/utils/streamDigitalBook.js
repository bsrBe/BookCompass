const axios = require("axios");
const Order = require("../models/orderModel");
const cloudinary = require("cloudinary").v2;
const jwt = require("jsonwebtoken");

// Verify required environment variables
const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_SECRET_KEY',
  'JWT_SECRET'
];

// Debug environment variables
console.log('[Stream] Environment variables status:', {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not Set',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not Set',
  CLOUDINARY_SECRET_KEY: process.env.CLOUDINARY_SECRET_KEY ? 'Set' : 'Not Set',
  JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not Set'
});

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('[Stream] Missing required environment variables:', missingEnvVars);
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
});

// Middleware to verify JWT token and user access
const verifyUserAccess = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Verify user has purchased the book
    const { bookId } = req.params;
    const order = await Order.findOne({
      user: decoded.id,
      "items.book": bookId,
      paymentStatus: "paid",
    });

    if (!order) {
      return res.status(403).json({ message: "You don't have access to this book" });
    }

    next();
  } catch (error) {
    console.error("[Auth] Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const streamDigitalBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.id;

    console.log(`[Stream] Attempting to stream book ${bookId} for user ${userId}`);

    const order = await Order.findOne({
      user: userId,
      "items.book": bookId,
      paymentStatus: "paid",
    }).populate("items.book");

    if (!order) {
      console.log(`[Stream] No paid order found for book ${bookId} and user ${userId}`);
      return res.status(403).json({ message: "You don't have access to this book" });
    }

    const book = order.items.find((item) => item.book._id.toString() === bookId)?.book;
    if (!book || (!book.isDigital && !book.isAudiobook) || !book.fileUrl) {
      console.log(`[Stream] Book validation failed:`, {
        bookExists: !!book,
        isDigital: book?.isDigital,
        isAudiobook: book?.isAudiobook,
        hasFileUrl: !!book?.fileUrl
      });
      return res.status(404).json({ message: "Digital content not found or inaccessible" });
    }

    console.log(`[Stream] Found book: ${book.title}, File URL: ${book.fileUrl}`);

    // Parse the Cloudinary URL
    const cloudinaryUrl = new URL(book.fileUrl);
    const pathParts = cloudinaryUrl.pathname.split('/');
    
    // Find the upload index
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) {
      console.error('[Stream] Invalid Cloudinary URL format');
      return res.status(500).json({ message: "Invalid file URL format" });
    }

    // Extract components
    const resourceType = pathParts[uploadIndex - 1]; // 'image' or 'raw' or 'video'
    const versionWithPrefix = pathParts[uploadIndex + 1];
    const version = versionWithPrefix.startsWith('v') ? versionWithPrefix.substring(1) : versionWithPrefix;
    
    // Get everything after version as the public ID
    const publicId = pathParts.slice(uploadIndex + 2).join('/');
    
    // Get the file extension from the original URL if it exists
    const fileExtension = book.fileUrl.split('.').pop().toLowerCase();
    const hasValidExtension = ['pdf', 'epub', 'mp3', 'mp4'].includes(fileExtension);
    
    console.log(`[Stream] URL parsing:`, {
      originalUrl: book.fileUrl,
      resourceType,
      version,
      publicId,
      fileExtension: hasValidExtension ? fileExtension : undefined
    });

    // Generate a signed URL
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        public_id: publicId,
        version: version,
        timestamp: timestamp,
        resource_type: resourceType
      },
      process.env.CLOUDINARY_SECRET_KEY
    );

    const authenticatedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      version: version,
      sign_url: true,
      secure: true,
      format: hasValidExtension ? fileExtension : undefined,
      transformation: resourceType === "raw" ? [] : [
        { fetch_format: "auto" },
        { quality: "auto" }
      ],
      timestamp: timestamp,
      signature: signature
    });

    console.log(`[Stream] Generated signed URL:`, {
      publicId,
      resourceType,
      version,
      timestamp,
      url: authenticatedUrl
    });

    try {
      // First verify the file exists with a HEAD request
      console.log(`[Stream] Verifying file existence with HEAD request`);
      try {
        const headResponse = await axios.head(authenticatedUrl, {
          timeout: 5000,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        });
        
        const contentType = headResponse.headers['content-type'];
        console.log(`[Stream] File exists, content type: ${contentType}`);

        // Set appropriate content type for response based on what Cloudinary is actually serving
        const isAudio = book.isAudiobook;
        const responseContentType = isAudio ? "audio/mpeg" : contentType;
        
        // Use appropriate file extension based on content type
        const responseFileExtension = contentType.includes('pdf') ? 'pdf' :
                            contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
                            contentType.includes('png') ? 'png' :
                            isAudio ? 'mp3' : 'pdf';
        
        const filename = `${book.title || 'content'}.${responseFileExtension}`;

        // Set appropriate headers
        res.setHeader("Content-Type", responseContentType);
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        if (req.query.download === 'true') {
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        } else {
          res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        }

        // Stream the file directly using the signed URL
        console.log(`[Stream] Attempting to fetch content with content type: ${responseContentType}`);
        const response = await axios.get(authenticatedUrl, { 
          responseType: "stream",
          timeout: 30000,
          maxContentLength: Infinity,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        });

        console.log(`[Stream] Successfully connected to resource, status: ${response.status}`);

        // Add error handler for the stream
        response.data.on('error', (streamError) => {
          console.error('[Stream] Error during stream piping:', streamError);
          if (!res.headersSent) {
            res.status(500).json({ error: "Error during content streaming" });
          }
        });

        // Add error handler for the response
        res.on('error', (resError) => {
          console.error('[Stream] Error in response stream:', resError);
        });

        // Add progress logging
        let bytesReceived = 0;
        response.data.on('data', (chunk) => {
          bytesReceived += chunk.length;
          if (bytesReceived % (1024 * 1024) === 0) { // Log every MB
            console.log(`[Stream] Downloaded ${Math.round(bytesReceived / (1024 * 1024))}MB for user ${userId}`);
          }
        });

        response.data.pipe(res);
      } catch (headError) {
        console.error('[Stream] HEAD request failed:', {
          status: headError.response?.status,
          statusText: headError.response?.statusText,
          headers: headError.response?.headers,
          url: authenticatedUrl
        });
        if (headError.response?.status === 404) {
          return res.status(404).json({ 
            message: "The digital content is no longer available",
            details: "The file may have been removed or is temporarily unavailable"
          });
        } else if (headError.response?.status === 401) {
          return res.status(401).json({ 
            message: "Access denied",
            details: "You don't have permission to access this content"
          });
        }
        throw headError;
      }
    } catch (axiosError) {
      console.error('[Stream] Axios error details:', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        headers: axiosError.response?.headers,
        userId: userId
      });

      if (axiosError.response?.status === 404) {
        return res.status(404).json({ 
          message: "The digital content is no longer available",
          details: "The file may have been removed or is temporarily unavailable"
        });
      }

      throw axiosError;
    }
  } catch (error) {
    console.error("[Stream] Detailed error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      response: error.response?.data,
      userId: req.user?.id
    });
    
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        message: "The digital content is no longer available",
        details: "The file may have been removed or is temporarily unavailable"
      });
    }

    res.status(500).json({ 
      error: "Error streaming content",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { streamDigitalBook, verifyUserAccess };
