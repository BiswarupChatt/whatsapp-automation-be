const EmployeeList = require("../models/employee.model");
const BirthdaySchedule = require("../models/birthdaySchedule.model");
const { sendMessage } = require("../services/whatsapp.service")
const messageEmitter = require("../events/messageEmitter");
const { sendEmail } = require("../utils/emailer");

function getNextBirthday(dob) {
    const now = new Date();
    const birthDate = new Date(dob);

    let nextBirthday = new Date(
        now.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
    );

    if (nextBirthday < now.setHours(0, 0, 0, 0)) {
        nextBirthday = new Date(
            now.getFullYear() + 1,
            birthDate.getMonth(),
            birthDate.getDate()
        );
    }

    return new Date(nextBirthday);
}


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


// exports.sendMessagesToday = async () => {
//     const today = new Date();

//     const startOfDay = new Date(today.setHours(0, 0, 0, 0));
//     const endOfDay = new Date(today.setHours(23, 59, 59, 999));

//     const schedules = await BirthdaySchedule.find({
//         status: "pending",
//         scheduledDate: { $gte: startOfDay, $lte: endOfDay }
//     }).populate(
//         "employeeId",
//         "firstName lastName empId phoneNumber designation"
//     );

//     if (schedules.length === 0) {
//         return { message: "No pending birthday messages for today." };
//     }

//     const groupName = "Test Group";

//     for (const sch of schedules) {
//         try {
//             await sendMessage({
//                 groupName,
//                 message: sch.message,
//                 imageUrl: sch.imageUrl || null
//             });

//             await BirthdaySchedule.findByIdAndUpdate(sch._id, {
//                 status: "sent",
//                 sentAt: new Date(),
//             });

//         } catch (err) {
//             console.error("Message sending failed for schedule:", sch._id, err);

//             await BirthdaySchedule.findByIdAndUpdate(sch._id, {
//                 status: "failed",
//             });
//         }
//     }

//     return { message: "Birthday messages processed successfully." };
// };


messageEmitter.on("sendTodayBirthdays", async ({ startOfDay, endOfDay }) => {

    console.log("🎉 Birthday background job started...");

    const summary = {
        total: 0,
        sent: 0,
        failed: 0,
        sentList: [],
        failedList: []
    };

    try {
        const schedules = await BirthdaySchedule.find({
            status: "pending",
            scheduledDate: { $gte: startOfDay, $lte: endOfDay }
        }).populate("employeeId", "firstName lastName empId designation");

        summary.total = schedules.length;

        for (const sch of schedules) {
            try {
                await sendMessage({
                    groupName: "Test Group",
                    message: sch.message,
                    imageUrl: sch.imageUrl || null
                });

                await BirthdaySchedule.findByIdAndUpdate(sch._id, {
                    status: "sent",
                    sentAt: new Date(),
                });

                summary.sent++;
                summary.sentList.push(`${sch.employeeId.firstName} ${sch.employeeId.lastName}`);

            } catch (err) {
                summary.failed++;
                summary.failedList.push(`${sch.employeeId.firstName} ${sch.employeeId.lastName}`);

                await BirthdaySchedule.findByIdAndUpdate(sch._id, {
                    status: "failed",
                });
            }
        }

        // 🔥 When done, emit completion event
        messageEmitter.emit("birthdayJobDone", summary);

    } catch (error) {
        console.error("🔥 Error in listener:", error);

        messageEmitter.emit("birthdayJobDone", {
            total: 0,
            sent: 0,
            failed: 0,
            sentList: [],
            failedList: [],
            error: error.message
        });
    }
});


// 📩 REPORT EMAIL SENDER
messageEmitter.on("birthdayJobDone", async (summary) => {
    console.log("🎯 Birthday job completed. Sending report email...");

    const htmlReport = `
        <h2>🎉 Birthday Message Report</h2>
        <p><b>Total Scheduled:</b> ${summary.total}</p>
        <p><b>Messages Sent:</b> ${summary.sent}</p>
        <p><b>Messages Failed:</b> ${summary.failed}</p>

        ${summary.sentList.length > 0 ? `
            <h3>✔ Sent To:</h3>
            <ul>${summary.sentList.map(name => `<li>${name}</li>`).join("")}</ul>
        ` : ""}

        ${summary.failedList.length > 0 ? `
            <h3>❌ Failed To:</h3>
            <ul>${summary.failedList.map(name => `<li>${name}</li>`).join("")}</ul>
        ` : `<p>No failures 🎉</p>`}

        ${summary.error ? `
            <h3>🔥 Job Error:</h3>
            <p>${summary.error}</p>
        ` : ""}
    `;

    try {
        await sendEmail({
            to: process.env.REPORT_EMAIL,
            subject: "Daily Birthday WhatsApp Report",
            html: htmlReport
        });

        console.log("📨 Report email sent successfully!");
    } catch (err) {
        console.error("❌ Failed to send report email:", err);
    }
});