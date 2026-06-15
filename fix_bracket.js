const fs = require('fs');
const filePath = 'c:\\Tanprix\\src\\screens\\SOSEmergencyScreen.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

let targetIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('addDebugLog("Reached ideal evidence count (5). Continuing to monitor up to 10.");')) {
        targetIndex = i;
        break;
    }
}

if (targetIndex !== -1) {
    // lines[targetIndex] is addDebugLog...
    // lines[targetIndex+1] is }  (closes IDEAL_EVIDENCE check)
    // lines[targetIndex+2] is }  (closes localEvidenceCount < MAX_EVIDENCE)
    // lines[targetIndex+3] is }  (closes if (detected))
    // We want to replace lines[targetIndex+4] which is currently `        }).catch(e => console.log("AI Error", e));`
    // And also `        } catch (e) {` on the next line.
    
    // We need to inject the `isDetectingFaceRef.current = false;` logic.
    const newCatchLine = '          }).catch(e => console.log("AI Error", e)).finally(() => {';
    const finallyCloseLine = '            isDetectingFaceRef.current = false;';
    const finallyEndLine = '          });';
    const ifCloseLine = '         }';
    
    // Check if what we are replacing matches roughly what we expect
    console.log("Replacing: " + lines[targetIndex + 4]);
    
    lines[targetIndex + 4] = newCatchLine;
    lines.splice(targetIndex + 5, 0, finallyCloseLine, finallyEndLine, ifCloseLine);
    
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log("Fix applied successfully!");
} else {
    console.log("Could not find the target line.");
}
