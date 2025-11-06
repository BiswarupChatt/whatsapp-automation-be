const fs = require("fs");
const path = require("path");
const { Boom } = require("@hapi/boom");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require("@whiskeysockets/baileys");
const { broadcast } = require("../utils/broadcast.utils");
const { clearAuthFolder } = require("../utils/file.utils");
const { MAX_RETRIES, QR_EXPIRY_MS } = require("../utils/constants");

let sock;
let isReady = false;
let isConnecting = false; // ✅ prevent multiple connects
let lastQr = null;
let reconnectAttempts = 0;
let qrTimeout = null;

async function connectToWhatsApp(isFresh = false) {
    if (isConnecting || isReady) {
        console.log("⚠️ Already connected or connecting — skipping new connection.");
        return;
    }

    try {
        isConnecting = true; // set lock
        if (isFresh) clearAuthFolder();

        const { state, saveCreds } = await useMultiFileAuthState("auth_info");

        // Close any existing socket gracefully
        if (sock) {
            try {
                await sock.ws.close();
            } catch (_) { }
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

            // 🔹 QR Code handling
            if (qr) {
                lastQr = qr;
                broadcast("qr", { qr });
                console.log("📱 New QR generated");
                startQrExpiryTimer();
            }

            // 🔹 Connected successfully
            if (connection === "open") {
                reconnectAttempts = 0;
                isReady = true;
                isConnecting = false; // unlock
                lastQr = null;

                const user = sock.user || {};
                const userInfo = {
                    name: user.name || "Unknown",
                    number: user.id ? user.id.split(":")[0] : "Unknown",
                };

                clearTimeout(qrTimeout);
                broadcast("connected", { connected: true, user: userInfo });
                console.log(`✅ Connected as ${userInfo.name} (${userInfo.number})`);
            }

            // 🔹 Disconnected
            if (connection === "close") {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log("❌ Disconnected. Reason:", statusCode);

                isReady = false;
                isConnecting = false; // unlock so reconnection can happen later
                broadcast("disconnected", { connected: false, reason: statusCode });

                handleReconnection(statusCode);
            }
        });

        sock.ev.on("messages.upsert", (m) => {
            console.log("📩 Message:", JSON.stringify(m, null, 2));
        });
    } catch (err) {
        console.error("❌ WhatsApp connection failed:", err.message);
        broadcast("error", { error: err.message });
        isConnecting = false; // ensure unlock on error
    }
}

function startQrExpiryTimer() {
    if (qrTimeout) clearTimeout(qrTimeout);
    qrTimeout = setTimeout(() => {
        if (!isReady && lastQr) {
            console.log("⏰ QR expired — reconnecting for new QR...");
            connectToWhatsApp(true);
        }
    }, QR_EXPIRY_MS);
}

function handleReconnection(statusCode) {
    const { loggedOut } = DisconnectReason;

    if (statusCode === loggedOut || statusCode === 401) {
        reconnectAttempts = 0;
        console.log("⚠️ Session expired, reconnecting fresh...");
        return connectToWhatsApp(true);
    }

    if (reconnectAttempts < MAX_RETRIES) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔁 Reconnecting in ${delay / 1000}s (Attempt ${reconnectAttempts})`);
        setTimeout(() => connectToWhatsApp(false), delay);
    } else {
        console.log("🚫 Max retries reached — resetting session...");
        reconnectAttempts = 0;
        connectToWhatsApp(true);
    }
}

function getSocketState() {
    return { isReady, isConnecting, lastQr, sock };
}

module.exports = { connectToWhatsApp, getSocketState };
