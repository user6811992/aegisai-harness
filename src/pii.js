// src/pii.js
// PII detection + redaction before prompts leave the machine or logs are stored.
const PATTERNS = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, label: 'email' },
  { re: /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, label: 'phone' },
  { re: /\b\d{3}-\d{2}-\d{4}\b/g, label: 'ssn' },
  { re: /\b(?:\d[ -]*?){13,19}\b/g, label: 'card' },
  { re: /\b(?:sk|pk|ghp|gho|github_pat)[-_][A-Za-z0-9]{16,}\b/g, label: 'api_key' },
];

function redact(text) {
  const s = String(text || '');
  let out = s;
  const findings = [];
  for (const p of PATTERNS) {
    out = out.replace(p.re, (m) => { findings.push(p.label); return '[' + p.label.toUpperCase() + '_REDACTED]'; });
  }
  return { text: out, findings, changed: findings.length > 0 };
}

module.exports = { PATTERNS, redact };
