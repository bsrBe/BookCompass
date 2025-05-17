const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getLibrary,
} = require("../controllers/userController");

router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.get("/library", protect, getLibrary); // Add this line

module.exports = router;
