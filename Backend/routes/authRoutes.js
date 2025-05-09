const express = require("express")
const router = express.Router()
console.log("authRoutes.js: Router instance created."); // Added for debugging
const {protect} = require("../middlewares/authMiddleware")
const cookieParser = require("cookie-parser");

router.use(cookieParser());

const  {
    register,
    Login,
    getMe,
    forgotPassword,
    resetPassword,
    confirmEmail
} = require("../controllers/authController")

router.get("/me" , protect ,getMe)
router.post("/register" , register)
router.post("/login" , Login)
router.post("/forgotPassword" ,forgotPassword)
router.put("/resetPassword/:token",resetPassword)
router.get("/confirmEmail/:token", (req, res, next) => { // Added wrapper for debugging
    console.log(`authRoutes.js: Received request for /confirmEmail/${req.params.token}`); // Added for debugging
    confirmEmail(req, res, next);
});
module.exports = router
