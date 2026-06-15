const os = require('os');
const interfaces = os.networkInterfaces();
let fallbackIp = 'localhost';
for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`Interface: ${name}, IP: ${iface.address}`);
        }
    }
}
