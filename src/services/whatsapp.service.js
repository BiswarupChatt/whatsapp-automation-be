const { Boom } = require("@hapi/boom");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require("@whiskeysockets/baileys");
const { broadcast } = require("../utils/broadcast.utils");
const { clearAuthFolder } = require("../utils/file.utils");
const { MAX_RETRIES, QR_EXPIRY_MS } = require("../utils/constants");
const axios = require("axios");
const mime = require("mime-types");

let sock;
let isReady = false;
let isConnecting = false;
let lastQr = null;
let reconnectAttempts = 0;
let qrTimeout = null;

let fileTypeFromBuffer = null;
(async () => {
    try {
        // Lazy-require to keep it optional if not installed
        fileTypeFromBuffer = (await import("file-type")).fileTypeFromBuffer;
    } catch (_) { }
})();

async function sendMessage({ groupName, message, imageUrl }) {
    const { sock, isReady } = getSocketState();
    if (!isReady) throw new Error("WhatsApp not connected yet.");

    try {
        console.log(`🔍 Looking for group: "${groupName}"`);
        const groups = await sock.groupFetchAllParticipating();
        const group = Object.values(groups).find(
            g => (g.subject || "").trim().toLowerCase() === (groupName || "").trim().toLowerCase()
        );

        if (!group) {
            const availableGroups = Object.values(groups).map(g => g.subject).join(", ");
            console.log(`📋 Available groups: ${availableGroups}`);
            throw new Error(`Group "${groupName}" not found.`);
        }

        console.log(`✅ Found group: ${group.id}`);

        // No image? Send plain text and return
        if (!imageUrl) {
            console.log(`🚀 Sending text message...`);
            await sock.sendMessage(group.id, { text: message || "" });
            console.log(`✅ Text message sent to group: ${groupName}`);
            return { success: true, group: groupName };
        }

        // Validate URL
        if (!/^https?:\/\//i.test(imageUrl)) {
            throw new Error("imageUrl must be an http(s) URL");
        }

        console.log(`🌐 Downloading image from: ${imageUrl}`);
        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            maxRedirects: 3,
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "image/*"
            }
        });

        const fileBuffer = Buffer.from(response.data);
        const sizeMB = fileBuffer.length / (1024 * 1024);
        console.log(`📊 Downloaded image: ${sizeMB.toFixed(2)}MB`);

        if (sizeMB > 16) {
            throw new Error(`Image too large: ${sizeMB.toFixed(2)}MB (max 16MB)`);
        }

        // Determine mime from magic bytes (best) → header → filename
        let detectedMime = null;
        if (fileTypeFromBuffer) {
            try {
                const detected = await fileTypeFromBuffer(fileBuffer); // { mime, ext } | undefined
                detectedMime = detected?.mime || null;
            } catch (_) { }
        }

        const headerMime = response.headers["content-type"];
        const mimetype = detectedMime || headerMime || mime.lookup(imageUrl) || "image/jpeg";
        console.log(`📄 Detected MIME type: ${mimetype}`);

        if (!String(mimetype).startsWith("image/")) {
            throw new Error(`Invalid content type: ${mimetype}`);
        }

        console.log(`🚀 Sending image to WhatsApp (buffer, no temp file)...`);
        await sock.sendMessage(group.id, {
            image: fileBuffer,
            mimetype,
            caption: message || ""
        });

        console.log(`✅ Image + caption sent to group: ${groupName}`);
        return { success: true, group: groupName };
    } catch (err) {
        console.error(`❌ Failed to send message:`, err);
        throw err;
    }
}


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

async function disconnectFromWhatsApp() {
    try {
        console.log("🔌 Disconnecting from WhatsApp...");

        if (sock) {
            try {
                await sock.ws.close();
                sock.ev.removeAllListeners();
                console.log("🧹 Socket closed and listeners removed.");
            } catch (err) {
                console.warn("⚠️ Error closing socket:", err.message);
            }
        }

        clearAuthFolder();
        console.log("🧹 Old WhatsApp session cleared.");

        // Ensure ALL flags are properly reset
        isReady = false;
        isConnecting = false;
        lastQr = null;
        reconnectAttempts = 0;
        sock = null;

        broadcast("disconnected", { connected: false, user: null });
    } catch (err) {
        console.error("❌ Error during disconnect:", err.message);
        throw err;
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


module.exports = { connectToWhatsApp, getSocketState, sendMessage, disconnectFromWhatsApp };
