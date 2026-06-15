const fs = require('fs');
const path = 'c:\\Tanprix\\src\\screens\\SOSEmergencyScreen.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic area is the end of results of hasHumanInImage(...).then(...)
// We need to change the unbalanced braces to }).catch(() => {});
// We search for a block that looks like:
// if (localEvidenceCount === IDEAL_EVIDENCE) { ... }
//   }
// }
// } catch (e) {

const pattern = /\s+if\s+\(localEvidenceCount\s+===\s+IDEAL_EVIDENCE\)\s+\{[\s\S]+?\}\s+\}\s+\}\s+\}\s+catch\s+\(e\)\s+\{/m;
const match = content.match(pattern);

if (match) {
    console.log("Found pattern, correcting...");
    // We want to replace the part between the end of the nested if and the catch
    // The match[0] currently ends with the catch.
    
    // Let's do a simpler line-by-line fix for the specific lines around 640
    const lines = content.split(/\r?\n/);
    // Grep for the pattern
    let lineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Reached ideal evidence count (5)')) {
            lineIndex = i;
            break;
        }
    }

    if (lineIndex !== -1) {
        console.log(`Found marker at line ${lineIndex + 1}`);
        // lineIndex is line 637
        // lines[lineIndex+1] should be '                }' (638)
        // lines[lineIndex+2] should be '              }' (639)
        // lines[lineIndex+3] should be '           }' (640)
        
        lines[lineIndex+3] = '            }).catch(() => {});';
        fs.writeFileSync(path, lines.join('\n'));
        console.log("File updated using line marker.");
    } else {
        console.log("Marker not found.");
    }
} else {
    console.log("Global pattern mismatch. Trying fallback...");
    // Just find line 640 and replace it if it looks like a closing brace
    const lines = content.split(/\r?\n/);
    if (lines[639] && lines[639].trim() === '}') {
        lines[639] = '            }).catch(() => {});';
        fs.writeFileSync(path, lines.join('\n'));
        console.log("Fallback: Line 640 updated.");
    }
}
