const authService = require("../services/admin.service");
const jwt = require("jsonwebtoken");

// Register
exports.registerAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await authService.register(username, password);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Login
exports.loginAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await authService.login(username, password);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Change Password
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const adminId = req.user.id; // from auth middleware
        const result = await authService.changePassword(adminId, oldPassword, newPassword);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
