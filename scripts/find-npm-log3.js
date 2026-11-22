const fs = require('fs');
const log = fs.readFileSync('npm-run-log.txt', 'utf8');
const lines = log.split(/\r?\n/);
// Find the publish step
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Run npm publish')) {
    console.log('Line', i, ':', lines[i].slice(0, 120));
  }
}
// Find all step names
const steps = lines.filter((l) => /##\[group\]Run /i.test(l));
console.log('\nSteps:', steps.length);
steps.forEach((s) => console.log(s.slice(0, 120)));
// Find any npm publish output
const publishLines = lines.filter((l) => l.includes('npm publish'));
console.log('\nnpm publish lines:', publishLines.length);
publishLines.forEach((l) => console.log(l.slice(0, 120)));
// Find error lines
const errLines = lines.filter((l) => /error|fail|E4/i.test(l));
console.log('\nerror/fail lines:', errLines.length);
errLines.slice(0, 10).forEach((l) => console.log(l.slice(0, 200)));
