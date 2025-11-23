const mongoose = require("mongoose");

const employeeListSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            trim: true,
        },
        empId: {
            type: String,
            trim: true,
        },
        phoneNumber: {
            type: String,
            unique: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        designation: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("EmployeeList", employeeListSchema);
