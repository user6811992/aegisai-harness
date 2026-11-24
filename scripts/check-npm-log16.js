const fs = require('fs');
const { execSync } = require('child_process');
const log = execSync('gh run view 45305918897 --log', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const lines = log.split(/\r?\n/);
const publishLines = lines.filter((l) => l.includes('+ aegisai-harness@'));
console.log('publish output:', publishLines.length);
publishLines.forEach((l) => console.log(l.slice(0, 100)));
const errors = lines.filter((l) => /npm error/i.test(l));
console.log('npm errors:', errors.length);
errors.forEach((l) => console.log(l.slice(0, 200)));
// Check if version in package.json matches
const pkgLines = lines.filter((l) => l.includes('npm notice version:'));
console.log('version lines:', pkgLines.length);
pkgLines.forEach((l) => console.log(l.slice(0, 100)));
