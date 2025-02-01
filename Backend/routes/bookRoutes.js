const express = require("express")
const router = express.Router()
const upload = require("../utils/multer")
const {protect , checkSellerRole} = require("../middlewares/authMiddleware")
const {
    getBook,
    getSingleBook,
    fetchMyBooks,
    createBook,
    updateBook,
    deleteBook
} = require("../controllers/bookController")

router.get("/getBook" , getBook)
router.get("/singleBook/:id" , getSingleBook)
router.get("/getBook/myBooks" , protect , checkSellerRole, fetchMyBooks)
router.post("/createBook" , protect , checkSellerRole , upload.single("image") , createBook)
router.put("/updateBook/:id" , protect, checkSellerRole ,updateBook)
router.delete("/deleteBook/:id" ,protect , checkSellerRole ,deleteBook)

module.exports = router;