const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model"); 

exports.authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized, token missing" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 🔥 Check if the admin exists in DB
        const admin = await Admin.findById(decoded.id);

        if (!admin) {
            return res.status(401).json({ error: "Admin no longer exists" });
        }

        req.admin = admin; // attach full admin data to request
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};
