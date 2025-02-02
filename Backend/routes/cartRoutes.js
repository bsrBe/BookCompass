const express = require("express")
const router = express.Router()
const {protect , checkBuyerRole} = require("../middlewares/authMiddleware")
const cookieParser = require("cookie-parser");
const { getCart, addToCart, updateCart, deleteCartItem } = require('../controllers/cartController');

router.use(cookieParser());

router.get("/getCart" , protect ,checkBuyerRole ,getCart)
router.post("/createCart" , protect , checkBuyerRole ,addToCart)
router.put("/updateCart/:id" , protect , checkBuyerRole , updateCart)
router.delete("/deleteCart/:id" , protect , checkBuyerRole , deleteCartItem)


module.exports = router