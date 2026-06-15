const { execSync } = require('child_process');
const fs = require('fs');
try {
  const data = execSync('git show HEAD:src/screens/SOSEmergencyScreen.js', { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
  fs.writeFileSync('c:/Tanprix/extracted_sos.js', data);
  console.log("Success");
} catch(e) { 
  console.error(e.message);
  try {
     const data2 = execSync('git show HEAD~1:src/screens/SOSEmergencyScreen.js', { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
     fs.writeFileSync('c:/Tanprix/extracted_sos.js', data2);
     console.log("Success with HEAD~1");
  } catch(e2) {
     console.error("Also failed HEAD~1:", e2.message);
  }
}
