const fs = require('fs');
const os = require('os');
const interfaces = os.networkInterfaces();
let ipText = '';
for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            ipText += `Interface: ${name}, IP: ${iface.address}\n`;
        }
    }
}
fs.writeFileSync('c:\\RakshaAi\\my_ip.txt', ipText);
