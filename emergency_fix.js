const fs = require('fs');
const filePath = 'c:\\Tanprix\\src\\screens\\SOSEmergencyScreen.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// We are looking for the end of the .then() block which is currently broken.
// Line 637: addDebugLog("Reached ideal evidence count (5)...
// Line 638: }
// Line 639: }
// Line 640: }
// Line 641: } catch (e) {

let targetIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Reached ideal evidence count (5)')) {
        targetIndex = i;
        break;
    }
}

if (targetIndex !== -1) {
    console.log("Found line at index " + targetIndex);
    // lines[targetIndex] is line 637
    // lines[targetIndex + 1] is line 638 (if close)
    // lines[targetIndex + 2] is line 639 (if close)
    // lines[targetIndex + 3] is line 640 (broken then close)
    
    // Let's verify what's at targetIndex + 3
    console.log("Line " + (targetIndex + 4) + ": [" + lines[targetIndex + 3] + "]");
    
    if (lines[targetIndex + 3].trim() === '}') {
        lines[targetIndex + 3] = '            }).catch(() => {});';
        fs.writeFileSync(filePath, lines.join('\n'));
        console.log("Fix applied successfully.");
    } else {
        console.log("Line signature mismatch!");
    }
} else {
    console.log("Could not find the target line.");
}
