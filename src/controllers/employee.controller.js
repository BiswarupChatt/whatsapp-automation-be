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

// ✅ Get upcoming birthdays (e.g., within next 10 or 15 days)
exports.getUpcomingBirthdays = async (req, res) => {
    try {
        const { days = 7 } = req.body; // Default: next 7 days if not provided

        // 1️⃣ Get today's date
        const today = new Date();
        const currentYear = today.getFullYear();

        // 2️⃣ Define range end date
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + parseInt(days));

        // 3️⃣ Fetch all active employees (you could optimize later)
        const allEmployees = await Employee.find({ isActive: true });

        // 4️⃣ Filter employees whose birthdays fall within the next X days
        const upcoming = allEmployees.filter((emp) => {
            if (!emp.dateOfBirth) return false;

            const dob = new Date(emp.dateOfBirth);
            const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());

            // If birthday already passed this year, consider next year's date
            if (birthdayThisYear < today) {
                birthdayThisYear.setFullYear(currentYear + 1);
            }

            const diffInDays = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));

            return diffInDays >= 0 && diffInDays <= parseInt(days);
        });

        // 5️⃣ Sort by upcoming date
        upcoming.sort((a, b) => {
            const aDate = new Date(a.dateOfBirth);
            const bDate = new Date(b.dateOfBirth);
            return aDate.getMonth() - bDate.getMonth() || aDate.getDate() - bDate.getDate();
        });

        // 6️⃣ Respond
        res.status(200).json({
            success: true,
            total: upcoming.length,
            upcomingDays: parseInt(days),
            data: upcoming,
        });
    } catch (error) {
        console.error(error);
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


