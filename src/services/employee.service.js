const Employee = require("../models/employee.model");

// ✅ Create Employee
exports.createEmployeeService = async (employeeData) => {
    const employee = new Employee(employeeData);
    return await employee.save();
};

// ✅ Get All Employees with Search, Sort, Pagination, and Month Filter
exports.getAllEmployeesService = async (query) => {
    const {
        search,
        isActive,
        month,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = 1,
        limit = 10,
    } = query;

    const filter = {
        $and: [
            { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }
        ]
    };

    if (isActive !== undefined) {
        filter.$and.push({ isActive: isActive === "true" });
    }

    if (search) {
        filter.$and.push({
            $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { empId: { $regex: search, $options: "i" } },
                { designation: { $regex: search, $options: "i" } },
            ]
        });
    }

    if (month) {
        const monthNum = parseInt(month);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            filter.$and.push({
                $expr: { $eq: [{ $month: "$dateOfBirth" }, monthNum] }
            });
        }
    }

    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [employees, totalCount] = await Promise.all([
        Employee.find(filter).sort(sortOptions).skip(skip).limit(parseInt(limit)),
        Employee.countDocuments(filter),
    ]);

    return {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
        data: employees,
    };
};

// ✅ Update Employee
exports.updateEmployeeService = async (id, updateData) => {
    return await Employee.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

// ✅ Delete Employee
exports.deleteEmployeeService = async (id) => {
    return await Employee.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
    );
};

// ✅ Get Upcoming Birthdays
exports.getUpcomingBirthdaysService = async (days = 7) => {
    const today = new Date();
    const currentYear = today.getFullYear();

    const allEmployees = await Employee.find({
        isActive: true,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    });

    const upcoming = allEmployees
        .map((emp) => {
            if (!emp.dateOfBirth) return null;

            const dob = new Date(emp.dateOfBirth);
            let birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());

            if (birthdayThisYear < today) {
                birthdayThisYear.setFullYear(currentYear + 1);
            }

            const diffInDays = Math.ceil(
                (birthdayThisYear - today) / (1000 * 60 * 60 * 24)
            );

            return { ...emp._doc, diffInDays };
        })
        .filter((emp) => emp && emp.diffInDays >= 0 && emp.diffInDays <= parseInt(days));

    upcoming.sort((a, b) => a.diffInDays - b.diffInDays);

    return {
        total: upcoming.length,
        upcomingDays: parseInt(days),
        data: upcoming,
    };
};

// ✅ Get Employee by ID
exports.getEmployeeByIdService = async (id) => {
    return await Employee.findOne({
        _id: id,
        isDeleted: false,
    });
};