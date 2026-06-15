const fs = require('fs');
const path = 'c:\\Tanprix\\src\\screens\\SOSEmergencyScreen.js';
let content = fs.readFileSync(path, 'utf8');

// Using a more robust replacement that doesn't rely on line numbers but on the surrounding context
const target = /\}\s+\}\s+catch\s+\(e\)\s+\{\s+addDebugLog\(`Capture\/AI Loop Error: \${e\.message}`\);/m;
const replacement = `            }
          }).catch(err => console.log("Bg AI Error:", err));
        } catch (e) {
          addDebugLog(\`Capture/AI Loop Error: \${e.message}\`);`;

if (content.match(target)) {
    console.log("Target found, applying fix...");
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log("Fix applied successfully.");
} else {
    console.log("Target NOT found. Checking alternative formatting...");
    // Fallback: search for the specific indentation pattern
    const lines = content.split('\\n');
    // Lines are roughly 638-643
    for (let i = 635; i < 645; i++) {
       console.log(\`Line \${i+1}: [\${lines[i]}]\`);
    }
}
