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

exports.schedule = (req, res) => {
    const { groupName, message, imagePath, delay } = req.body;
    setTimeout(async () => {
        try {
            await sendMessage({ groupName, message, imagePath });
            console.log(`Scheduled message sent to ${groupName}`);
        } catch (err) {
            console.error(err);
        }
    }, delay * 60 * 1000);

    res.json({ success: true, message: `Message scheduled in ${delay} minutes` });
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
