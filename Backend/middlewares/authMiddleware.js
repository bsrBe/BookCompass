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

const protect = async (req, res, next) => {
  let token;

  // Check for token in cookies (cookieToken)
  if (req.cookies && req.cookies.cookieToken) {
    token = req.cookies.cookieToken;
  }
  // Check for token in Authorization header (Bearer token)
  else if (req.headers.authorization && req.headers.authorization.toLowerCase().startsWith('bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token is found in either cookies or Authorization header
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // Verify the token with JWT secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user to the request object (excluding password)
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Not authorized, token expired" });
    }
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
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

module.exports = { protect, checkSellerRole, checkBuyerRole };