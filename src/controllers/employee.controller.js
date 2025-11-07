const Employee = require("../models/employee.model");

// ✅ Create a new employee
exports.createEmployee = async (req, res) => {
    try {
        const employee = new Employee(req.body);
        await employee.save();
        res.status(201).json({
            success: true,
            message: "Employee added successfully",
            data: employee,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ✅ Get all employees with search, sort, pagination, and birthday/month filter
exports.getAllEmployees = async (req, res) => {
    try {
        // 1️⃣ Extract query params
        const {
            search,           // keyword
            isActive,         // true/false
            month,            // filter by birth month (1-12)
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 10,
        } = req.query;

        // 2️⃣ Build filter object dynamically
        const filter = {};

        if (isActive !== undefined) filter.isActive = isActive === "true";

        // 3️⃣ Add search (case-insensitive)
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { empId: { $regex: search, $options: "i" } },
                { designation: { $regex: search, $options: "i" } },
            ];
        }

        // 4️⃣ Birthday month filter
        if (month) {
            const monthNum = parseInt(month);
            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                filter.$expr = {
                    $eq: [{ $month: "$dateOfBirth" }, monthNum],
                };
            }
        }

        // 5️⃣ Sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

        // 6️⃣ Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 7️⃣ Query DB
        const employees = await Employee.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await Employee.countDocuments(filter);

        // 8️⃣ Send response
        res.status(200).json({
            success: true,
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / limit),
            data: employees,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ✅ Get single employee by ID
exports.getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        res.status(200).json({
            success: true,
            data: employee,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ✅ Update employee
exports.updateEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: employee,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ✅ Delete employee
exports.deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Employee deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
