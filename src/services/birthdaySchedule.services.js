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
        message: message || `Happy Birthday ${employee.name} 🎉! Wishing you a wonderful year ahead!`,
        imageUrl: imageUrl || null,
        status: "pending",
    });

    return schedule;
};
