const mongoose = require("mongoose");

async function connectDB() {
    try {
        const uri = "mongodb+srv://chatterjeebiswarup61_db_user:WFC6f40eoXprNTqP@cluster0.j6mbvym.mongodb.net/?appName=Cluster0";
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
