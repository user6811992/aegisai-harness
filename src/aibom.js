// src/aibom.js
// AIBOM generator: CycloneDX 1.6-style BOM for harness runtime/model/skill/MCP/hooks/secrets.
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

function components() {
  const out = [];
  out.push({ type: 'application', 'bom-ref': 'harness', name: pkg.name, version: pkg.version, description: pkg.description });
  out.push({ type: 'model-card', 'bom-ref': 'model:' + (process.env.AEGISAI_MODEL || 'default'), name: 'configured model', version: process.env.AEGISAI_MODEL || 'default' });
  try { for (const s of require('./skill_pkg').list()) out.push({ type: 'library', 'bom-ref': 'skill:' + s.name, name: s.name, version: s.source || '' }); } catch (e) {}
  try { for (const m of require('./mcp_marketplace').list()) out.push({ type: 'library', 'bom-ref': 'mcp:' + m.name, name: m.name, version: 'catalog' }); } catch (e) {}
  try { for (const e of require('./event_bus').bus.events()) out.push({ type: 'framework', 'bom-ref': 'hook:' + e, name: e }); } catch (e) {}
  const secretKeys = Object.keys(process.env).filter((k) => /TOKEN|KEY|SECRET|PASSWORD/.test(k)).map((k) => ({ type: 'secret-surface', 'bom-ref': 'env:' + k, name: k }));
  out.push(...secretKeys);
  return out;
}
function generate() {
  return {
    bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
    serialNumber: 'urn:uuid:' + Date.now(),
    metadata: { timestamp: new Date().toISOString(), tools: [{ vendor: 'aegisai', name: 'aibom', version: '1.0' }] },
    components: components(),
  };
}
function write(outPath) {
  const p = outPath || path.join(process.cwd(), 'aibom.json');
  fs.writeFileSync(p, JSON.stringify(generate(), null, 2));
  return p;
}

module.exports = { components, generate, write };
