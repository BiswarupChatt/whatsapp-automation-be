const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");

// ========== Register ==========
exports.register = async (username, password) => {
    const existing = await Admin.findOne({ username });
    if (existing) throw new Error("Admin already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
        username,
        password: hashedPassword,
    });

    return {
        message: "Admin registered successfully",
        admin: { username: admin.username, id: admin._id },
    };
};

// ========== Login ==========
exports.login = async (username, password) => {
    const admin = await Admin.findOne({ username });
    if (!admin) throw new Error("Invalid username or password");

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) throw new Error("Invalid username or password");

    const token = jwt.sign(
        { id: admin._id, username: admin.username },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    return {
        message: "Login successful",
        token,
        admin: { id: admin._id, username: admin.username },
    };
};

// ========== Change Password ==========
exports.changePassword = async (adminId, oldPassword, newPassword) => {
    const admin = await Admin.findById(adminId);
    if (!admin) throw new Error("Admin not found");

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) throw new Error("Old password is incorrect");

    const hashedNew = await bcrypt.hash(newPassword, 10);
    admin.password = hashedNew;
    await admin.save();

    return { message: "Password changed successfully" };
};
