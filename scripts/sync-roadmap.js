// scripts/sync-roadmap.js
// Sync the ROADMAP.md "Current version" line with package.json.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const roadmapPath = path.join(ROOT, 'ROADMAP.md');
let text = fs.readFileSync(roadmapPath, 'utf8');
text = text.replace(/Current version:\*\*\s*v[\d.]+/, 'Current version:** v' + version);
fs.writeFileSync(roadmapPath, text, 'utf8');
console.log('Roadmap synced to v' + version);
