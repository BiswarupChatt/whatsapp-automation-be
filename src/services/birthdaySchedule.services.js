const EmployeeList = require("../models/employee.model");
const BirthdaySchedule = require("../models/birthdaySchedule.model");

const getNextBirthday = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
    return nextBirthday;
};

exports.createScheduleForEmployee = async (employeeId, message, imageUrl) => {
    const employee = await EmployeeList.findById(employeeId);
    if (!employee) {
        throw new Error("Employee not found");
    }

    const nextBirthday = getNextBirthday(employee.dateOfBirth);

    const existing = await BirthdaySchedule.findOne({
        employeeId,
        scheduledDate: nextBirthday,
    });

    if (existing) {
        throw new Error("Birthday schedule already exists for this date");
    }

    const schedule = await BirthdaySchedule.create({
        employeeId,
        scheduledDate: nextBirthday,
        message: message || `Happy Birthday ${employee.firstName} 🎉! Wishing you a wonderful year ahead!`,
        imageUrl: imageUrl || null,
        status: "pending",
    });

    await EmployeeList.findByIdAndUpdate(
        employeeId,
        { isMessageScheduled: true },
        { new: true }
    );

    return schedule;
};

// Get all schedules (optionally filter by status or date)
exports.getAllSchedules = async (filters = {}) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.fromDate && filters.toDate) {
        query.scheduledDate = {
            $gte: new Date(filters.fromDate),
            $lte: new Date(filters.toDate),
        };
    }

    return await BirthdaySchedule.find(query)
        .populate("employeeId", "firstName lastName empId phoneNumber designation")
        .sort({ scheduledDate: 1 });
};


// Get upcoming schedules
exports.getUpcomingSchedules = async (query) => {
    const {
        search = "",
        sortBy = "scheduledDate",
        sortOrder = "asc",
        page = 1,
        limit = 10,
    } = query;

    const today = new Date();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === "desc" ? -1 : 1;

    // Find matching employees first (if search provided)
    const employeeFilter = {};
    if (search) {
        employeeFilter.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { empId: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
        ];
    }

    const employees = await EmployeeList.find(employeeFilter).select("_id");
    const employeeIds = employees.map((e) => e._id);

    // Build schedule query
    const scheduleQuery = {
        scheduledDate: { $gte: today }, // only upcoming
    };
    if (search && employeeIds.length > 0) {
        scheduleQuery.employeeId = { $in: employeeIds };
    } else if (search && employeeIds.length === 0) {
        // No employees match search — return empty result early
        return { data: [], total: 0, page: Number(page), totalPages: 0 };
    }

    // Fetch data
    const [data, total] = await Promise.all([
        BirthdaySchedule.find(scheduleQuery)
            .populate("employeeId", "firstName lastName empId phoneNumber designation")
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(parseInt(limit)),
        BirthdaySchedule.countDocuments(scheduleQuery),
    ]);

    return {
        data,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
    };
};


// Get single schedule by ID
exports.getScheduleById = async (id) => {
    const schedule = await BirthdaySchedule.findById(id).populate(
        "employeeId",
        "firstName lastName empId phoneNumber designation"
    );
    if (!schedule) throw new Error("Birthday schedule not found");
    return schedule;
};

// Update a schedule
exports.updateSchedule = async (id, updateData) => {

    const schedule = await BirthdaySchedule.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });

    if (!schedule) throw new Error("Birthday schedule not found");

    const populatedSchedule = await BirthdaySchedule.findById(id).populate(
        "employeeId",
        "firstName lastName empId phoneNumber designation"
    );

    return populatedSchedule;
};


// Delete a schedule
exports.deleteSchedule = async (id) => {
    const deleted = await BirthdaySchedule.findByIdAndDelete(id);
    if (!deleted) throw new Error("Birthday schedule not found");
    return deleted;
};
