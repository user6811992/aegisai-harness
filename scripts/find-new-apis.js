const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mods = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'index.js');
const patterns = [/\.toSorted\(/, /\.findLast\(/, /\.findLastIndex\(/, /\.at\(/, /structuredClone\(/, /URL\.canParse\(/, /fs\.globSync\(/, /Promise\.withResolvers\(/, /Object\.groupBy\(/, /Array\.fromAsync\(/];
const hits = [];
for (const m of mods) {
  const text = fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  for (const p of patterns) if (p.test(text)) hits.push(m + ' uses ' + p.source);
}
console.log('new-API usage:', hits.length);
hits.forEach((h) => console.log(h));
