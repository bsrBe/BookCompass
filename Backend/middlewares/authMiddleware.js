// const jwt = require("jsonwebtoken");
// const User = require("../models/userModel");

// const protect = async (req, res, next) => {
//   // Try to get the token from the cookies, specifically the "cookieToken" cookie

//   const token = req.cookies.cookieToken;

//   // If no token is found in the cookies
//   if (!token) {
//     return res.status(401).json({ message: "Not authorized, no token" });
//   }

//   try {
//     // Verify the token with JWT secret
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Attach the user to the request object (excluding password)
//     req.user = await User.findById(decoded.id).select("-password");

//     // Proceed to the next middleware or route handler
//     next();
//   } catch (error) {
//     // Token verification failed, unauthorized access
//     return res.status(401).json({ message: "Not authorized, token failed" });
//   }
// };

// const checkSellerRole = (req , res ,next) => {

//   if(req.user && req.user.role === 'seller'){
//     next()
//   }else {
//     res.status(403).json({ error: "Access denied. Only sellers can perform this action." });
// }
// }

// const checkBuyerRole = (req , res , next)=> {
//   if(req.user && req.user.role === "buyer"){
//     next()
//   }else {
//     return res.status(403).json({ error: "Access denied. Only buyer users not seller(admins) can perform this action." })
//   }
// }

// module.exports = { protect , checkSellerRole , checkBuyerRole};













const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// Protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route',
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          message: 'User not found'
        });
      }

      // Check if user is blocked
      if (req.user.isBlocked) {
        return res.status(403).json({
          success: false,
          error: 'Account is blocked',
          message: 'Your account has been blocked. Please contact support.'
        });
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token has expired',
          message: 'Token has expired'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route',
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

const checkSellerRole = (req, res, next) => {
  if (req.user && req.user.role === 'seller') {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Only sellers can perform this action." });
  }
};

const checkBuyerRole = (req, res, next) => {
  if (req.user && req.user.role === "buyer") {
    next();
  } else {
    return res.status(403).json({ error: "Access denied. Only buyer users not seller(admins) can perform this action." });
  }
};

module.exports = { protect, checkSellerRole, checkBuyerRole, authorize };
