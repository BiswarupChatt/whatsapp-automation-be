const cors = require("cors");
const express = require("express");
const http = require("http");
const { initWebSocket } = require("./websocket");

function createServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    const server = http.createServer(app);
    const wss = initWebSocket(server);

    return { app, server, wss };
}

module.exports = createServer;
