// =================== ENV & DEPENDENCIES ===================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const connectDB = require("./src/config/database");
const { initWebSocket, getWebSocket } = require("./src/config/websocket");
const messageRoutes = require("./src/routes/message.routes");
const employeeRoutes =require("./src/routes/employee.route")
const { connectToWhatsApp, getSocketState } = require("./src/services/whatsapp.service");

// =================== INITIAL SETUP ===================
const app = express();
app.use(cors());
app.use(express.json());

// =================== ROUTES ===================
app.use("/", messageRoutes);
app.use("/employee", employeeRoutes);


// =================== SERVER & WEBSOCKET ===================
const server = http.createServer(app);
initWebSocket(server); // Create WebSocket Server
const wss = getWebSocket();

// =================== WEBSOCKET HANDLERS ===================
wss.on("connection", (ws) => {
    console.log("🌐 Frontend connected via WebSocket");

    const { isReady, lastQr, sock } = getSocketState();
    const user = sock?.user
        ? {
            name: sock.user.name || "Unknown",
            number: sock.user.id ? sock.user.id.split(":")[0] : "Unknown",
        }
        : null;

    ws.send(JSON.stringify({ event: "status", data: { connected: isReady, user } }));

    if (lastQr && !isReady) {
        ws.send(JSON.stringify({ event: "qr", data: { qr: lastQr } }));
    }

    ws.on("close", () => console.log("❌ WebSocket client disconnected"));
});

// =================== SERVER STARTUP ===================
(async () => {
    try {
        await connectDB(); // Connect to MongoDB
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () =>
            console.log(`✅ Server running on http://localhost:${PORT}`)
        );

        connectToWhatsApp(); // Start WhatsApp connection
    } catch (error) {
        console.error("❌ Startup failed:", error.message);
    }
})();
