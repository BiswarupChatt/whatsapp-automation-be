const fs = require("fs");
const path = require("path");

function clearAuthFolder() {
    const dir = path.join(__dirname, "../../auth_info");
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log("🧹 Old WhatsApp session cleared.");
    }
}

module.exports = { clearAuthFolder };
