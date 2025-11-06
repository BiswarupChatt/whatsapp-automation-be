const fs = require("fs");
const { getSocketState } = require("./whatsapp.service");

async function sendMessage({ groupName, message, imagePath }) {
    const { sock, isReady } = getSocketState();
    if (!isReady) throw new Error("WhatsApp not connected yet.");

    const groups = await sock.groupFetchAllParticipating();
    const group = Object.values(groups).find(g => g.subject === groupName);
    if (!group) throw new Error("Group not found.");

    if (imagePath && fs.existsSync(imagePath)) {
        const buffer = fs.readFileSync(imagePath);
        await sock.sendMessage(group.id, { image: buffer, caption: message });
    } else {
        await sock.sendMessage(group.id, { text: message });
    }

    return { success: true, group: groupName };
}

module.exports = { sendMessage };
