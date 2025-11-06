const WebSocket = require("ws");

let wss;

function initWebSocket(server) {
    wss = new WebSocket.Server({ server });
    console.log("🌐 WebSocket initialized");
    return wss;
}

function getWebSocket() {
    return wss;
}

module.exports = { initWebSocket, getWebSocket };
