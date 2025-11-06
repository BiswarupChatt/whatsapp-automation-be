const mongoose = require("mongoose");

const messageLogSchema = new mongoose.Schema(
    {
        groupName: String,
        message: String,
        imagePath: String,
        status: {
            type: String,
            enum: ["sent", "scheduled", "failed"],
            default: "sent",
        },
        sentAt: { type: Date, default: Date.now },
        error: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model("MessageLog", messageLogSchema);
