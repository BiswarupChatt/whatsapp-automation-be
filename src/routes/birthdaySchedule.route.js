// routes/birthdayScheduleRoutes.js
const express = require("express");
const router = express.Router();
const {
    createBirthdaySchedule,
} = require("../controllers/birthdaySchedule.controller");

router.post("/:employeeId", createBirthdaySchedule);

module.exports = router;
