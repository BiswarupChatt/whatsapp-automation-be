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

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (search) {
        filter.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { empId: { $regex: search, $options: "i" } },
            { designation: { $regex: search, $options: "i" } },
        ];
    }

    if (month) {
        const monthNum = parseInt(month);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            filter.$expr = {
                $eq: [{ $month: "$dateOfBirth" }, monthNum],
            };
        }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
    const skip = (parseInt(page) - 1) * parseInt(limit);

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

// ✅ Get Employee by ID
exports.getEmployeeByIdService = async (id) => {
    return await Employee.findById(id);
};

// ✅ Get Upcoming Birthdays
exports.getUpcomingBirthdaysService = async (days = 7) => {
    const today = new Date();
    const currentYear = today.getFullYear();

    const allEmployees = await Employee.find({ isActive: true });

    const upcoming = allEmployees.filter((emp) => {
        if (!emp.dateOfBirth) return false;

        const dob = new Date(emp.dateOfBirth);
        const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());

        if (birthdayThisYear < today) birthdayThisYear.setFullYear(currentYear + 1);

        const diffInDays = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));

        return diffInDays >= 0 && diffInDays <= parseInt(days);
    });

    upcoming.sort((a, b) => {
        const aDate = new Date(a.dateOfBirth);
        const bDate = new Date(b.dateOfBirth);
        return aDate.getMonth() - bDate.getMonth() || aDate.getDate() - bDate.getDate();
    });

    return { total: upcoming.length, upcomingDays: parseInt(days), data: upcoming };
};

// ✅ Update Employee
exports.updateEmployeeService = async (id, updateData) => {
    return await Employee.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

// ✅ Delete Employee
exports.deleteEmployeeService = async (id) => {
    return await Employee.findByIdAndDelete(id);
};
