// src/sarif.js
// Convert vulnerability findings to SARIF 2.1.0 for CI/security tooling.
const LEVEL = { high: 'error', medium: 'warning', low: 'note' };

function fromFindings(findings, toolName) {
  const rules = [], results = [];
  const seen = new Set();
  for (const f of findings || []) {
    const id = f.label.replace(/\W+/g, '_').toLowerCase();
    if (!seen.has(id)) { seen.add(id); rules.push({ id, name: f.label, shortDescription: { text: f.label } }); }
    results.push({
      ruleId: id,
      level: LEVEL[f.severity] || 'warning',
      message: { text: f.label + (f.code ? ': ' + f.code : '') },
      locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.line || 1 } } }],
    });
  }
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{ tool: { driver: { name: toolName || 'aegisai-vuln-scan', rules } }, results }],
  };
}

module.exports = { fromFindings };
