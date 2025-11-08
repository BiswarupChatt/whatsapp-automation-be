const birthdayScheduleService = require("../services/birthdaySchedule.services");

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