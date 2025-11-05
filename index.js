const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let sock; // WhatsApp socket
let isReady = false;
let lastQr = null; // Store latest QR text

// ====================== CONNECT WHATSAPP ======================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    sock = makeWASocket({ printQRInTerminal: false, auth: state });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;

        // Send QR to frontend
        if (qr) {
            lastQr = qr;
            broadcast("qr", { qr });
            console.log("📱 New QR generated and sent to frontend");
        }

        // Connection success
        if (connection === "open") {
            isReady = true;
            lastQr = null;

            const user = sock.user || {};
            const userInfo = {
                name: user.name || "Unknown",
                number: user.id ? user.id.split(":")[0] : "Unknown",
            };
            broadcast("connected", { connected: true, user: userInfo });
            console.log(`✅ WhatsApp connected as ${userInfo.name} (${userInfo.number})`);
        }


        // Disconnection or reconnect
        if (connection === "close") {
            isReady = false;
            broadcast("disconnected", { connected: false });
            console.log("❌ WhatsApp disconnected. Reconnecting...");
            connectToWhatsApp();
        }
    });
}

// Broadcast to all connected WebSocket clients
function broadcast(event, data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event, data }));
        }
    });
}

// ====================== MESSAGE FUNCTION ======================
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
app.get("/", (req, res) => res.send("🚀 WhatsApp API running"));

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

// ====================== WEBSOCKET ======================
wss.on("connection", (ws) => {
    console.log("🌐 Frontend connected via WebSocket");

    // Always send current connection status
    const user = sock?.user || null;
    const userInfo = user
        ? {
            name: user.name || "Unknown",
            number: user.id ? user.id.split(":")[0] : "Unknown",
        }
        : null;

    console.log(userInfo, "9798798797(*&(*&(*&(*&(*&")

    ws.send(
        JSON.stringify({
            event: "status",
            data: {
                connected: isReady,
                user: isReady ? userInfo : null,
            },
        })
    );

    // If QR available and not connected, send it too
    if (lastQr && !isReady) {
        ws.send(JSON.stringify({ event: "qr", data: { qr: lastQr } }));
    }

    ws.on("close", () => console.log("❌ WebSocket client disconnected"));
});


// ====================== START SERVER ======================
server.listen(5000, () => console.log("✅ Backend running on http://localhost:5000"));
connectToWhatsApp();
