const express = require("express")
const router = express.Router()
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
router.post("/forgotPassword" ,protect,  forgotPassword)
router.put("/resetPassword/:token", protect ,resetPassword)
router.get("/confirmEmail/:token", confirmEmail);
module.exports = router