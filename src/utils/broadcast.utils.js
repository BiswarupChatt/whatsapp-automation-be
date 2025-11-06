const { getWebSocket } = require("../config/websocket");

function broadcast(event, data) {
    const wss = getWebSocket();
    if (!wss) return;
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify({ event, data }));
        }
    });
}

module.exports = { broadcast };
