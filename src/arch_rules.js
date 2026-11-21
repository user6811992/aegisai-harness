// src/arch_rules.js
// Architecture import-boundary rule benchmark: infer layers, detect violations.
const codeMap = require('./code_map');
const path = require('path');

function inferLayers(root) {
  const map = codeMap.build(root, 200);
  const layers = {};
  for (const f of map) {
    const top = f.path.split(/[\\/]/)[0] || 'root';
    layers[top] = (layers[top] || 0) + 1;
  }
  return Object.entries(layers).sort((a, b) => b[1] - a[1]).map(([name, files]) => ({ name, files }));
}
function checkBoundaries(root, rules) {
  rules = rules || [];
  const map = codeMap.build(root, 200);
  const violations = [];
  for (const f of map) {
    const layer = f.path.split(/[\\/]/)[0];
    for (const c of f.calls) {
      for (const r of rules) {
        if (r.from === layer && r.to && c.name.toLowerCase().includes(r.to.toLowerCase())) {
          violations.push({ file: f.path, line: c.line, from: layer, to: r.to, call: c.name, rule: 'no ' + layer + ' -> ' + r.to });
        }
      }
    }
  }
  return { violations, checked: map.length, rules: rules.length };
}

module.exports = { inferLayers, checkBoundaries };
