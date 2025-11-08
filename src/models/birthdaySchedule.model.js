const mongoose = require("mongoose");

const birthdayScheduleSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EmployeeList",
            required: true,
        },
        message: {
            type: String,
            default: "Happy Birthday 🎉! Wishing you a wonderful year ahead!",
            trim: true,
        },
        imageUrl:{
            type: String
        },
        scheduledDate: {
            type: Date,
            required: true, // when the message will be sent
        },
        sentAt: {
            type: Date, // when the message was actually sent
            default: null,
        },
        status: {
            type: String,
            enum: ["pending", "sent", "failed"],
            default: "pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("BirthdaySchedule", birthdayScheduleSchema);
