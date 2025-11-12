const { sendMessage, disconnectFromWhatsApp } = require("../services/whatsapp.service");
const { connectToWhatsApp } = require("../services/whatsapp.service");
const { clearAuthFolder } = require("../utils/file.utils");

exports.healthCheck = (req, res) => {
    res.send("WhatsApp API running");
};

exports.sendNow = async (req, res) => {
    try {
        const result = await sendMessage(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};


exports.resetSession = async (req, res) => {
    try {
        await disconnectFromWhatsApp(); // cleanly close current session
        await connectToWhatsApp(true);  // start fresh connection for new QR
        res.json({ success: true, message: "Session reset — new QR will appear shortly." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
