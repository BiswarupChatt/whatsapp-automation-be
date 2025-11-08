const express = require("express");
const router = express.Router();
const controller = require("../controllers/whatsapp.controller");

router.get("/", controller.healthCheck);
router.post("/send-now", controller.sendNow);
router.post("/schedule", controller.schedule);
router.post("/reset-session", controller.resetSession);

module.exports = router;
