const fs = require('fs');
const path = 'c:\\Tanprix\\src\\screens\\SOSEmergencyScreen.js';
let content = fs.readFileSync(path, 'utf8');

// Find the marker: addDebugLog("Reached ideal evidence count (5). Continuing to monitor up to 10.");
// Then the next lines are:
//                }
//              }
//           }
//         } catch (e) {
//       }, 1500);

const lines = content.split(/\r?\n/);
let found = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Reached ideal evidence count (5)')) {
        // Correct the closing of the then() block
        // line i+1 is } for if (IDEAL)
        // line i+2 is } for if (detected)
        // line i+3 is } for callback
        if (lines[i+3] && lines[i+3].trim() === '}') {
            lines[i+3] = '            }).catch(() => {});';
            found = true;
            break;
        }
    }
}

if (found) {
    fs.writeFileSync(path, lines.join('\n'));
    console.log("SUCCESS: Fixed syntax error.");
} else {
    console.log("FAILED: Could not find markers.");
}
