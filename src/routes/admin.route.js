const express = require("express");
const router = express.Router();
const { registerAdmin, loginAdmin, changePassword } = require("../controllers/admin.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// Register admin (only once)
router.post("/register", registerAdmin);

// Login
router.post("/login", loginAdmin);

// Change password (only after login)
router.post("/change-password", authMiddleware, changePassword);

module.exports = router;
