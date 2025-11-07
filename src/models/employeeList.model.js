const mongoose = require("mongoose");

const employeeListSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        empId: {
            type: String,
            unique: true,
            trim: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        department: {
            type: String,
            trim: true,
        },
        designation: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("EmployeeList", employeeListSchema);
