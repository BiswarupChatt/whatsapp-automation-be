const EmployeeList = require("../models/employee.model");
const BirthdaySchedule = require("../models/birthdaySchedule.model")

exports.createEmployeeService = async (employeeData) => {
    const employee = new EmployeeList(employeeData);
    return await employee.save();
};

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
        EmployeeList.find(filter).sort(sortOptions).skip(skip).limit(parseInt(limit)),
        EmployeeList.countDocuments(filter),
    ]);

    return {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
        data: employees,
    };
};

exports.updateEmployeeService = async (id, updateData) => {
    return await EmployeeList.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

exports.deleteEmployeeService = async (id) => {
    return await EmployeeList.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
    );
};

exports.getUpcomingBirthdaysService = async (days = 7, includeToday = true) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();

    const allEmployees = await EmployeeList.find({
        isActive: true,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    });

    const upcoming = await Promise.all(
        allEmployees.map(async (emp) => {
            if (!emp.dateOfBirth) return null;

            const dob = new Date(emp.dateOfBirth);

            let birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
            birthdayThisYear.setHours(0, 0, 0, 0);

            const isToday = birthdayThisYear.getTime() === today.getTime();

            if (birthdayThisYear < today || (isToday && !includeToday)) {
                birthdayThisYear.setFullYear(currentYear + 1);
            }

            const diffInDays = Math.ceil(
                (birthdayThisYear - today) / (1000 * 60 * 60 * 24)
            );

            if (diffInDays < 0 || diffInDays > parseInt(days)) return null;

            // check schedule
            const checkSchedule = await BirthdaySchedule.findOne({
                employeeId: emp._id,
                status: "pending"
            }).lean();

            return {
                ...emp._doc,
                diffInDays,
                isMessageScheduled: !!checkSchedule
            };
        })
    );

    const filtered = upcoming.filter((emp) => emp !== null);
    filtered.sort((a, b) => a.diffInDays - b.diffInDays);

    return {
        total: filtered.length,
        upcomingDays: parseInt(days),
        includeToday,
        data: filtered,
    };
};



// ✅ Get EmployeeList by ID
exports.getEmployeeByIdService = async (id) => {
    return await EmployeeList.findOne({
        _id: id,
        isDeleted: false,
    });
};