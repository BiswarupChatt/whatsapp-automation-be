const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { Boom } = require("@hapi/boom");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ====================== GLOBAL STATE ======================
let sock; // WhatsApp socket
let isReady = false;
let lastQr = null;
let reconnectAttempts = 0;
let qrTimeout = null; // for auto-expiry
const MAX_RETRIES = 5;
const QR_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

// ====================== HELPERS ======================

// Broadcast to all connected WebSocket clients
function broadcast(event, data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event, data }));
        }
    });
}

// Safely clear old session data
function clearAuthFolder() {
    const dir = path.join(__dirname, "auth_info");
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log("🧹 Old WhatsApp session cleared.");
    }
}

// Start QR expiry timer (auto-reset if not scanned)
function startQrExpiryTimer() {
    if (qrTimeout) clearTimeout(qrTimeout);
    qrTimeout = setTimeout(() => {
        if (!isReady && lastQr) {
            console.log("⏰ QR expired — restarting connection for a new QR...");
            connectToWhatsApp(true);
        }
    }, QR_EXPIRY_MS);
}

// ====================== CONNECT WHATSAPP ======================
async function connectToWhatsApp(isFresh = false) {
    try {
        if (isFresh) clearAuthFolder();

        const { state, saveCreds } = await useMultiFileAuthState("auth_info");

        // Close any existing socket before reconnecting
        if (sock) {
            try {
                await sock.ws.close();
            } catch (err) { }
        }

        sock = makeWASocket({
            printQRInTerminal: false,
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: false,
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // --- QR Handling ---
            if (qr) {
                lastQr = qr;
                broadcast("qr", { qr });
                console.log("📱 New QR generated and sent to frontend");
                startQrExpiryTimer();
            }

            // --- Connected Successfully ---
            if (connection === "open") {
                reconnectAttempts = 0;
                isReady = true;
                lastQr = null;

                const user = sock.user || {};
                const userInfo = {
                    name: user.name || "Unknown",
                    number: user.id ? user.id.split(":")[0] : "Unknown",
                };

                if (qrTimeout) clearTimeout(qrTimeout);
                broadcast("connected", { connected: true, user: userInfo });
                console.log(`✅ WhatsApp connected as ${userInfo.name} (${userInfo.number})`);
            }

            // --- Disconnected ---
            if (connection === "close") {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log("❌ Disconnected. Reason:", statusCode);
                isReady = false;
                broadcast("disconnected", { connected: false, reason: statusCode });

                // --- If user logged out or session expired ---
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log("⚠️ Session expired. Starting fresh connection with new QR...");
                    reconnectAttempts = 0;
                    return connectToWhatsApp(true); // Fresh connection, new QR
                }

                // --- Controlled Reconnect ---
                if (reconnectAttempts < MAX_RETRIES) {
                    reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // exponential backoff
                    console.log(`🔁 Retrying in ${delay / 1000}s (Attempt ${reconnectAttempts}/${MAX_RETRIES})`);
                    setTimeout(() => connectToWhatsApp(false), delay);
                } else {
                    console.log("🚫 Max retries reached. Starting new session with fresh QR...");
                    reconnectAttempts = 0;
                    connectToWhatsApp(true); // Fresh connection, send QR
                }
            }
        });

        sock.ev.on("messages.upsert", (m) => {
            console.log("📩 Message event:", JSON.stringify(m, undefined, 2));
        });

    } catch (error) {
        console.error("❌ WhatsApp connection failed:", error.message);
        broadcast("error", { error: error.message });
    }
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

// Send message instantly
app.post("/api/send-now", async (req, res) => {
    const { groupName, message, imagePath } = req.body;
    try {
        const result = await sendMessage({ groupName, message, imagePath });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Schedule message
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

// Manual disconnect & reset session
app.post("/api/reset-session", async (req, res) => {
    try {
        console.log("🧾 Manual disconnect triggered...");
        await sock?.ws.close();
        clearAuthFolder();
        connectToWhatsApp(true);
        res.json({ success: true, message: "Session reset — new QR will be sent soon." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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
