const fs = require("fs");
const MessageLog = require("../models/messageLog.model");
const { getSocketState } = require("./whatsapp.service");

async function sendMessage({ groupName, message, imagePath }) {
    const { sock, isReady } = getSocketState();

    // --- Check WhatsApp connection ---
    if (!isReady) {
        throw new Error("WhatsApp not connected yet.");
    }

    try {
        // --- Fetch all groups ---
        const groups = await sock.groupFetchAllParticipating();
        const group = Object.values(groups).find((g) => g.subject === groupName);

        if (!group) {
            throw new Error("Group not found.");
        }

        // --- Send the message ---
        if (imagePath && fs.existsSync(imagePath)) {
            const buffer = fs.readFileSync(imagePath);
            await sock.sendMessage(group.id, { image: buffer, caption: message });
        } else {
            await sock.sendMessage(group.id, { text: message });
        }

        console.log("🟢 Creating log entry in DB...");
        await MessageLog.create({
            groupName,
            message,
            imagePath,
            status: "sent",
            sentAt: new Date(),
        });
        console.log("✅ Log saved successfully!");


        console.log(`✅ Message sent and logged for group: ${groupName}`);
        return { success: true, group: groupName };

    } catch (err) {
        console.error(`❌ Failed to send message to ${groupName}: ${err.message}`);
        // ❌ We skip logging failures as per your requirement
        throw err;
    }
}

module.exports = { sendMessage };
