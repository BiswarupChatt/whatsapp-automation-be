const mongoose = require("mongoose");

async function connectDB() {
    try {
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
