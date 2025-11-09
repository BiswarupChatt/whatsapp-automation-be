const { sendMessage } = require("../services/whatsapp.service");
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
        clearAuthFolder();
        await connectToWhatsApp(true);
        res.json({ success: true, message: "Session reset — new QR will be sent soon." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
