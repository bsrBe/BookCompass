const express = require("express");
const router = express.Router();
const {
  getDashboardOverview,
  getUsers,
  getUser,
  createUser,
  deleteUser,
  blockUser,
  unblockUser, // Import unblockUser
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateAdminProfile,
  toggleMaintenanceMode,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middlewares/authMiddleware")

router.use(protect);
router.use(authorize("admin"));

router.get("/dashboard", getDashboardOverview);
router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.post("/createUsers", createUser);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/block", blockUser);
router.put("/users/:id/unblock", unblockUser); // Add unblock route
router.get("/products", getProducts);
router.post("/newProducts", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);
router.put("/profile", updateAdminProfile);
router.put("/maintenance", toggleMaintenanceMode);

module.exports = router;
