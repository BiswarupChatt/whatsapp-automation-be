const birthdayScheduleService = require("../services/birthdaySchedule.services");
const messageEmitter = require("../events/messageEmitter")

exports.createBirthdaySchedule = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { message, imageUrl } = req.body || {};

        const schedule = await birthdayScheduleService.createScheduleForEmployee(
            employeeId,
            message,
            imageUrl
        );

        res.status(201).json({
            message: "Birthday schedule created successfully!",
            data: schedule,
        });
    } catch (error) {
        console.error("Error creating birthday schedule:", error.message);
        res.status(400).json({ error: error.message });
    }
};

// READ — get all schedules
exports.getAllSchedules = async (req, res) => {
    try {
        const schedules = await birthdayScheduleService.getAllSchedules(req.query);
        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUpcomingSchedules = async (req, res) => {
    try {
        const result = await birthdayScheduleService.getUpcomingSchedules(req.query);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// READ — get one schedule
exports.getScheduleById = async (req, res) => {
    try {
        const schedule = await birthdayScheduleService.getScheduleById(req.params.id);
        res.status(200).json(schedule);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

// UPDATE — update a schedule
exports.updateSchedule = async (req, res) => {
    try {
        const updated = await birthdayScheduleService.updateSchedule(req.params.id, req.body);
        res.status(200).json({
            message: "Birthday schedule updated successfully!",
            data: updated,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// DELETE — delete a schedule
exports.deleteSchedule = async (req, res) => {
    try {
        const deleted = await birthdayScheduleService.deleteSchedule(req.params.id);
        res.status(200).json({
            message: "Birthday schedule deleted successfully!",
            data: deleted,
        });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

exports.sendMessagesToday = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // 🔥 Emit event → background processing starts
        messageEmitter.emit("sendTodayBirthdays", {
            startOfDay,
            endOfDay,
        });

        return res.status(200).json({
            success: true,
            message: "Birthday messages are being processed in background.",
        });
    } catch (error) {
        console.error("Error in sendMessagesToday Controller:", error);

        return res.status(500).json({
            success: false,
            error: error.message || "Failed to send scheduled messages",
        });
    }
};