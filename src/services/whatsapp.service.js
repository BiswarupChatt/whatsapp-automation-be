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
let lastQr = null;
let reconnectAttempts = 0;
let qrTimeout = null;

async function connectToWhatsApp(isFresh = false) {
    try {
        if (isFresh) clearAuthFolder();

        const { state, saveCreds } = await useMultiFileAuthState("auth_info");

        if (sock) await sock.ws.close().catch(() => { });
        sock = makeWASocket({
            printQRInTerminal: false,
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: false,
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                lastQr = qr;
                broadcast("qr", { qr });
                console.log("📱 New QR generated");
                startQrExpiryTimer();
            }

            if (connection === "open") {
                reconnectAttempts = 0;
                isReady = true;
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

            if (connection === "close") {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                isReady = false;
                broadcast("disconnected", { connected: false, reason: statusCode });
                handleReconnection(statusCode);
            }
        });

        sock.ev.on("messages.upsert", (m) => {
            console.log("📩 Message event:", JSON.stringify(m, undefined, 2));
        });
    } catch (err) {
        console.error("❌ WhatsApp connection failed:", err.message);
        broadcast("error", { error: err.message });
    }
}

function startQrExpiryTimer() {
    if (qrTimeout) clearTimeout(qrTimeout);
    qrTimeout = setTimeout(() => {
        if (!isReady && lastQr) connectToWhatsApp(true);
    }, QR_EXPIRY_MS);
}

function handleReconnection(statusCode) {
    const { loggedOut } = DisconnectReason;
    if (statusCode === loggedOut || statusCode === 401) {
        reconnectAttempts = 0;
        return connectToWhatsApp(true);
    }
    if (reconnectAttempts < MAX_RETRIES) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔁 Retrying in ${delay / 1000}s`);
        setTimeout(() => connectToWhatsApp(false), delay);
    } else {
        reconnectAttempts = 0;
        connectToWhatsApp(true);
    }
}

function getSocketState() {
    return { isReady, lastQr, sock };
}

module.exports = { connectToWhatsApp, getSocketState };
