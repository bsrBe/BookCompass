const express = require("express")
const router = express.Router()
console.log("authRoutes.js: Router instance created."); // Added for debugging
const {protect , authorize} = require("../middlewares/authMiddleware") // Import authorize
const cookieParser = require("cookie-parser");

router.use(cookieParser());

const  {
    register,
    Login,
    getMe,
    forgotPassword,
    resetPassword,
    confirmEmail,
    inviteAdmin
} = require("../controllers/authController")

router.get("/me" , protect ,getMe)
router.post("/register" , register)
router.post("/login" , Login)
router.post("/forgotPassword" ,forgotPassword)
router.put("/resetPassword/:token",resetPassword)
router.get("/confirmEmail/:token", (req, res, next) => {
    confirmEmail(req, res, next);
});

// Route to invite an admin (only accessible by existing admins)
router.post("/inviteAdmin", protect, authorize('admin'), inviteAdmin);

module.exports = router
