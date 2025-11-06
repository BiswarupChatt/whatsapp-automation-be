const express = require("express");
const router = express.Router();
const controller = require("../controllers/whatsapp.controller");

router.get("/", controller.healthCheck);
router.post("/api/send-now", controller.sendNow);
router.post("/api/schedule", controller.schedule);
router.post("/api/reset-session", controller.resetSession);

module.exports = router;
