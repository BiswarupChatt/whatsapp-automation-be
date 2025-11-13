const employeeService = require("../services/employee.service");

// ✅ Create
exports.createEmployee = async (req, res) => {
    try {
        const employee = await employeeService.createEmployeeService(req.body);
        res.status(201).json({
            success: true,
            message: "Employee added successfully",
            data: employee,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ✅ Get All
exports.getAllEmployees = async (req, res) => {
    try {
        const data = await employeeService.getAllEmployeesService(req.query);
        res.status(200).json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Update
exports.updateEmployee = async (req, res) => {
    try {
        const employee = await employeeService.updateEmployeeService(req.params.id, req.body);
        if (!employee)
            return res.status(404).json({ success: false, message: "Employee not found" });
        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: employee,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ✅ Delete
exports.deleteEmployee = async (req, res) => {
    try {
        const employee = await employeeService.deleteEmployeeService(req.params.id);
        if (!employee)
            return res.status(404).json({ success: false, message: "Employee not found" });
        res.status(200).json({ success: true, message: "Employee deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Get by ID
exports.getEmployeeById = async (req, res) => {
    try {
        const employee = await employeeService.getEmployeeByIdService(req.params.id);
        if (!employee)
            return res.status(404).json({ success: false, message: "Employee not found" });
        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Upcoming Birthdays
exports.getUpcomingBirthdays = async (req, res) => {
    try {
        const { days = 7 } = req.body;
        const result = await employeeService.getUpcomingBirthdaysService(days);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};