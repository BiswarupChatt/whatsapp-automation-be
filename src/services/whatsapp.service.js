const { Boom } = require("@hapi/boom");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require("@whiskeysockets/baileys");
const axios = require("axios");
const mime = require("mime-types");
const { broadcast } = require("../utils/broadcast.utils");
const { clearAuthFolder } = require("../utils/file.utils");
const { MAX_RETRIES, QR_EXPIRY_MS } = require("../utils/constants");

let sock = null;
let isReady = false;
let isConnecting = false;
let lastQr = null;
let reconnectAttempts = 0;
let qrTimeout = null;
let manualDisconnect = false; // to avoid auto-reconnect when user calls disconnect
let fileTypeFromBuffer = null;

// =================== OPTIONAL file-type loader ===================
(async () => {
    try {
        const mod = await import("file-type");
        fileTypeFromBuffer = mod.fileTypeFromBuffer;
    } catch (_) {
        console.log("file-type not installed, falling back to mime-types only.");
    }
})();

// =================== PUBLIC: SEND MESSAGE ===================
async function sendMessage({ groupName, message, imageUrl }) {
    const { sock, isReady } = getSocketState();
    if (!isReady || !sock || !sock.user) {
        throw new Error("WhatsApp not connected yet.");
    }

    try {
        console.log(`🔍 Looking for group: "${groupName}"`);
        const groups = await sock.groupFetchAllParticipating();
        const group = Object.values(groups).find(
            (g) => (g.subject || "").trim().toLowerCase() === (groupName || "").trim().toLowerCase()
        );

        if (!group) {
            const availableGroups = Object.values(groups)
                .map((g) => g.subject)
                .join(", ");
            console.log(`📋 Available groups: ${availableGroups}`);
            throw new Error(`Group "${groupName}" not found.`);
        }

        console.log(`✅ Found group: ${group.id}`);

        // No image? Send plain text
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
                Accept: "image/*",
            },
        });

        const fileBuffer = Buffer.from(response.data);
        const sizeMB = fileBuffer.length / (1024 * 1024);
        console.log(`📊 Downloaded image: ${sizeMB.toFixed(2)}MB`);

        if (sizeMB > 16) {
            throw new Error(`Image too large: ${sizeMB.toFixed(2)}MB (max 16MB)`);
        }

        // Try to detect mime
        let detectedMime = null;
        if (fileTypeFromBuffer) {
            try {
                const detected = await fileTypeFromBuffer(fileBuffer);
                detectedMime = detected?.mime || null;
            } catch (_) { }
        }

        const headerMime = response.headers["content-type"];
        const mimetype = detectedMime || headerMime || mime.lookup(imageUrl) || "image/jpeg";
        console.log(`📄 Detected MIME type: ${mimetype}`);

        if (!String(mimetype).startsWith("image/")) {
            throw new Error(`Invalid content type: ${mimetype}`);
        }

        console.log(`🚀 Sending image to WhatsApp (buffer)...`);
        await sock.sendMessage(group.id, {
            image: fileBuffer,
            mimetype,
            caption: message || "",
        });

        console.log(`✅ Image + caption sent to group: ${groupName}`);
        return { success: true, group: groupName };
    } catch (err) {
        console.error(`❌ Failed to send message:`, err);
        throw err;
    }
}

// =================== CORE: CONNECT LOGIC ===================
async function connectToWhatsApp(forceNewSession = false) {
    if (isConnecting) {
        console.log("⚠️ Already connecting — skipping new connection.");
        return;
    }

    if (isReady && sock && sock.user) {
        console.log("⚠️ Already connected — skipping new connection.");
        return;
    }

    try {
        isConnecting = true;
        manualDisconnect = false;

        if (forceNewSession) {
            console.log("🧹 Clearing old auth session (forceNewSession = true)...");
            clearAuthFolder();
        }

        const { state, saveCreds } = await useMultiFileAuthState("auth_info");

        // Prefer using sock?.end() instead of direct ws.close()
        if (sock?.end) {
            try {
                await sock.end();
            } catch (e) {
                console.log("⚠️ Error ending previous socket:", e.message);
            }
        }

        sock = makeWASocket({
            printQRInTerminal: false,
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            // You can tweak browser info if needed
            browser: ["Chrome", "Desktop", "1.0.0"],
        });

        // Save creds when updated
        sock.ev.on("creds.update", saveCreds);

        // Connection updates
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR handling
            if (qr) {
                lastQr = qr;
                broadcast("qr", { qr });
                console.log("📱 New QR generated");
                startQrExpiryTimer();
            }

            if (connection === "open") {
                reconnectAttempts = 0;
                isReady = true;
                isConnecting = false;
                lastQr = null;

                clearTimeout(qrTimeout);

                const user = sock.user || {};
                const userInfo = {
                    name: user.name || "Unknown",
                    number: user.id ? user.id.split(":")[0] : "Unknown",
                };

                broadcast("connected", { connected: true, user: userInfo });
                console.log(`✅ WhatsApp connected as ${userInfo.name} (${userInfo.number})`);
            }

            if (connection === "close") {
                isReady = false;
                isConnecting = false;
                clearTimeout(qrTimeout);

                const boom = new Boom(lastDisconnect?.error);
                const statusCode = boom.output?.statusCode;
                const reason = boom.message || "Unknown";

                console.log("❌ WhatsApp connection closed:", { statusCode, reason });

                broadcast("disconnected", {
                    connected: false,
                    reason: statusCode,
                });

                if (manualDisconnect) {
                    console.log("🛑 Manual disconnect — skipping auto-reconnect.");
                    manualDisconnect = false;
                    return;
                }

                handleReconnection(statusCode);
            }
        });

        // Minimal message handler (ignore when not ready)
        sock.ev.on("messages.upsert", (m) => {
            if (!isReady || !sock?.user) {
                console.log("📩 Incoming message ignored (session not ready).");
                return;
            }
            console.log("📩 Message upsert:", JSON.stringify(m, null, 2));
            // You can add your own business logic here later
        });
    } catch (err) {
        console.error("❌ WhatsApp connection failed:", err.message);
        broadcast("error", { error: err.message });
        isConnecting = false;
    }
}

// =================== RECONNECT HANDLER ===================
function handleReconnection(statusCode) {
    const { loggedOut } = DisconnectReason;

    // True logout -> clear auth and force new session
    if (statusCode === loggedOut || statusCode === 401) {
        console.log("⚠️ Session logged out / invalid. Clearing auth and starting fresh...");
        reconnectAttempts = 0;
        clearAuthFolder();
        setTimeout(() => connectToWhatsApp(true), 2000);
        return;
    }

    // Other transient errors -> retry with backoff WITHOUT clearing auth
    if (reconnectAttempts < MAX_RETRIES) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔁 Reconnecting in ${delay / 1000}s (Attempt ${reconnectAttempts})...`);
        setTimeout(() => connectToWhatsApp(false), delay);
    } else {
        console.log("🚫 Max retries reached — clearing session and starting new.");
        reconnectAttempts = 0;
        clearAuthFolder();
        setTimeout(() => connectToWhatsApp(true), 5000);
    }
}

// =================== QR EXPIRY HANDLING ===================
function startQrExpiryTimer() {
    if (qrTimeout) clearTimeout(qrTimeout);

    qrTimeout = setTimeout(() => {
        if (!isReady && lastQr) {
            console.log("⏰ QR expired — requesting new QR (same session)...");
            // We DO NOT clear auth here. Just re-init connection so Baileys gives a new QR.
            connectToWhatsApp(false);
        }
    }, QR_EXPIRY_MS);
}

// =================== PUBLIC: DISCONNECT LOGIC ===================
async function disconnectFromWhatsApp() {
    console.log("🔌 Manual disconnect from WhatsApp requested...");

    try {
        manualDisconnect = true;

        if (sock?.end) {
            try {
                await sock.end();
                console.log("🧹 Socket ended gracefully.");
            } catch (err) {
                console.warn("⚠️ Error ending socket:", err.message);
            }
        }

        clearTimeout(qrTimeout);

        // If you want manual disconnect to also wipe session (so next time QR is required),
        // you can leave this as true. If you want to keep session, comment this out.
        clearAuthFolder();
        console.log("🧹 Old WhatsApp auth session cleared (manual disconnect).");

        isReady = false;
        isConnecting = false;
        lastQr = null;
        reconnectAttempts = 0;
        sock = null;

        broadcast("disconnected", { connected: false, user: null });
    } catch (err) {
        console.error("❌ Error during manual disconnect:", err.message);
        throw err;
    } finally {
        manualDisconnect = false;
    }
}

// =================== PUBLIC: SOCKET STATE ===================
function getSocketState() {
    return { isReady, isConnecting, lastQr, sock };
}

module.exports = {
    connectToWhatsApp,
    getSocketState,
    sendMessage,
    disconnectFromWhatsApp,
};
