const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

const filesToFix = ['Stations.js', 'RangeCalculator.js', 'RouteCheck.js'];

filesToFix.forEach(file => {
    let filePath = path.join(pagesDir, file);
    let original = fs.readFileSync(filePath, 'utf8');
    
    // Replace fetch(`url`) with fetch(`url`, { headers: ... })
    // and fetch("url") ...
    // Note: It already has one in RouteCheck.js which we should not double-replace.
    // The previously fixed one in RouteCheck was:
    // fetch(`https://nominatim...`, { headers: ... })
    // So we only replace if not followed by `, {`
    
    let updated = original.replace(/fetch\(\s*(`https:\/\/nominatim\.openstreetmap\.org[^`]+`)\s*\)/g, 
        "fetch($1, { headers: { 'User-Agent': 'EV-Assistant-App/1.0 (contact@evassistant.com)' } })");
    
    if (updated !== original) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`Fixed User-Agent in ${file}`);
    }
});
