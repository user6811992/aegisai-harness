// src/security_layers.js
// 5-layer security posture: perimeter / identity / tool / execution / data.
const fs = require('fs');
const path = require('path');

function posture() {
  const layers = [
    { layer: 'perimeter', controls: ['auth token', 'rate limiting', 'offline mode'], status: 'present' },
    { layer: 'identity', controls: ['agent lifecycle', 'gateway rules', 'tenant isolation'], status: 'present' },
    { layer: 'tool', controls: ['capabilities', 'policy engine', 'charter', 'MCP scanner', 'AHP gateway'], status: 'present' },
    { layer: 'execution', controls: ['sandbox rings', 'sealed Docker', 'Podman', 'action guard', 'admission gate'], status: 'present' },
    { layer: 'data', controls: ['PII redaction', 'vault', 'audit ledger', 'git state', 'gems redaction'], status: 'present' },
  ];
  const missing = [];
  const checks = {
    'src/guardrails.js': 'prompt defense',
    'src/mcp_security.js': 'MCP scanner',
    'src/policy.js': 'policy engine',
    'src/pii.js': 'PII redaction',
    'src/ledger.js': 'audit ledger',
    'src/sealed.js': 'sealed execution',
  };
  for (const [file, label] of Object.entries(checks)) {
    if (!fs.existsSync(path.join(__dirname, file))) missing.push(label);
  }
  return { layers, missing, score: Math.round(((Object.keys(checks).length - missing.length) / Object.keys(checks).length) * 100) };
}

module.exports = { posture };
