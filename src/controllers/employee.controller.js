const employeeService = require("../services/employee.service");

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

exports.getAllEmployees = async (req, res) => {
    try {
        const data = await employeeService.getAllEmployeesService(req.query);
        res.status(200).json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

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

exports.getUpcomingBirthdays = async (req, res) => {
    try {
        const { days = 7 } = req.body;
        const result = await employeeService.getUpcomingBirthdaysService(days);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createManyEmployees = async (req, res) => {
    try {
        const result = await employeeService.createManyEmployeesService(req.body);

        return res.status(201).json({
            message: "Employees uploaded successfully",
            data: result
        });

    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};
