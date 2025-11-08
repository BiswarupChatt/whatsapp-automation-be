// routes/birthdayScheduleRoutes.js
const express = require("express");
const router = express.Router();
const {
    createBirthdaySchedule, getAllSchedules, getUpcomingSchedules, getScheduleById, deleteSchedule, updateSchedule
} = require("../controllers/birthdaySchedule.controller");

router.post("/:employeeId", createBirthdaySchedule);

router.get("/all", getAllSchedules);
router.get("/upcoming", getUpcomingSchedules);
router.get("/:id", getScheduleById);

router.put("/:id", updateSchedule);

router.delete("/:id", deleteSchedule);

module.exports = router;
