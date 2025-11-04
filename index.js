const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());
app.use(cors());

let sock; // WhatsApp socket
let isReady = false;

// ====================== CONNECT WHATSAPP ======================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    sock = makeWASocket({ auth: state });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log("📱 Scan the QR code below:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "open") {
            console.log("✅ WhatsApp connected successfully!");
            isReady = true;
        } else if (connection === "close") {
            console.log("❌ Connection closed. Reconnecting...");
            isReady = false;
            connectToWhatsApp();
        }
    });
}

connectToWhatsApp();

// ====================== SEND MESSAGE FUNCTION ======================
async function sendMessage({ groupName, message, imagePath }) {
    if (!isReady) throw new Error("WhatsApp not connected yet.");

    const groups = await sock.groupFetchAllParticipating();
    const group = Object.values(groups).find((g) => g.subject === groupName);
    if (!group) throw new Error("Group not found.");

    if (imagePath && fs.existsSync(imagePath)) {
        const buffer = fs.readFileSync(imagePath);
        await sock.sendMessage(group.id, { image: buffer, caption: message });
    } else {
        await sock.sendMessage(group.id, { text: message });
    }

    return { success: true, group: groupName };
}

// ====================== EXPRESS ROUTES ======================
app.post("/api/send-now", async (req, res) => {
    const { groupName, message, imagePath } = req.body;
    try {
        const result = await sendMessage({ groupName, message, imagePath });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/schedule", (req, res) => {
    const { groupName, message, imagePath, delay } = req.body; // delay in minutes
    setTimeout(async () => {
        try {
            await sendMessage({ groupName, message, imagePath });
            console.log(`✅ Scheduled message sent to ${groupName}`);
        } catch (err) {
            console.error(err);
        }
    }, delay * 60 * 1000);

    res.json({ success: true, message: `Message scheduled in ${delay} minutes` });
});

app.get("/", (req, res) => res.send("🚀 WhatsApp API running"));

app.listen(5000, () => console.log("✅ Backend running on port 5000"));
