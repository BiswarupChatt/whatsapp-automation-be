// routes/birthdayScheduleRoutes.js
const express = require("express");
const router = express.Router();
const {
    createBirthdaySchedule, getAllSchedules, getUpcomingSchedules, getScheduleById, deleteSchedule, updateSchedule, sendMessagesToday
} = require("../controllers/birthdaySchedule.controller");

router.post("/:employeeId", createBirthdaySchedule);
router.get("/all", getAllSchedules);
router.get("/upcoming", getUpcomingSchedules);
router.get("/:id", getScheduleById);
router.put("/:id", updateSchedule);
router.delete("/:id", deleteSchedule);
router.get("/send/today", sendMessagesToday);

module.exports = router;
