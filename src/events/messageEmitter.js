const EventEmitter = require("events");

class MessageEmitter extends EventEmitter { }

module.exports = new MessageEmitter();
