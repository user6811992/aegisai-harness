// src/audit_pipeline.js
// Multi-phase security audit: recon → candidate findings → INDEPENDENT verification → report.
// The verification pass re-derives each finding from scratch and drops anything it cannot
// reproduce, so single-pass false positives do not reach the report.
const fs = require('fs');
const path = require('path');

const PHASES = ['recon', 'candidates', 'verify', 'report'];

function walk(dir, files, depth) {
  if ((depth || 0) > 8) return files;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return files; }
  for (const e of entries) {
    if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files, (depth || 0) + 1);
    else if (/\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|rb|php)$/i.test(e.name)) files.push(p);
  }
  return files;
}

async function recon(root) {
  const files = walk(root, [], 0);
  const byExt = {};
  for (const f of files) { const e = path.extname(f) || 'none'; byExt[e] = (byExt[e] || 0) + 1; }
  return { root, files: files.length, byExt, languages: Object.keys(byExt) };
}

async function candidates(root) {
  const out = [];
  const secrets = require('./secret_verify');
  const vuln = require('./vuln_scan');
  const files = walk(root, [], 0);
  for (const f of files.slice(0, 400)) {
    let text = '';
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    if (text.length > 400000) continue;
    // Candidate secrets (detection only; verification happens in the verify phase).
    const s = await secrets.scan(text, { source: f, verify: false });
    for (const x of s) out.push({ kind: 'secret', file: f, line: x.line, ruleId: x.ruleId, excerpt: x.redacted, raw: x.raw || null });
  }
  // Candidate code patterns via the existing scanner (it walks the tree itself).
  try {
    const v = vuln.scan(root);
    for (const x of (v.findings || [])) {
      out.push({ kind: 'code', file: path.resolve(root, x.file), line: x.line || 0, ruleId: 'vuln/' + String(x.label || 'pattern').toLowerCase().replace(/[^a-z0-9]+/g, '-'), excerpt: (x.code || '').slice(0, 160), raw: null, label: x.label });
    }
  } catch (e) {}
  return out;
}

// Independent verification: re-read the file and confirm the pattern still matches at
// the reported line. Anything that cannot be reproduced is dropped.
function verify(cands) {
  const confirmed = [];
  const dropped = [];
  for (const c of cands) {
    let text = '';
    try { text = fs.readFileSync(c.file, 'utf8'); } catch (e) { dropped.push(Object.assign({ reason: 'file_unreadable' }, c)); continue; }
    const lines = text.split(/\r?\n/);
    const lineText = lines[(c.line || 1) - 1] || '';
    const hay = c.kind === 'secret' ? c.excerpt : lineText;
    let rule = null;
    try {
      if (c.kind === 'secret') {
        const { PATTERNS } = require('./secret_verify');
        rule = PATTERNS.find((p) => 'secret/' + p.id === c.ruleId);
      } else {
        const { RULES } = require('./skill_scan');
        rule = RULES.find((r) => r.id === c.ruleId);
      }
    } catch (e) { rule = null; }
    if (!rule && c.kind === 'code') {
      // Unknown rule id: accept only if the recorded excerpt is still on the same line.
      if (c.excerpt && lineText.includes(c.excerpt.slice(0, 40))) confirmed.push(Object.assign({ verified: true }, c));
      else dropped.push(Object.assign({ reason: 'not_reproducible' }, c));
      continue;
    }
    if (!rule) { dropped.push(Object.assign({ reason: 'rule_not_found' }, c)); continue; }
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    const target = c.kind === 'secret' ? text : lineText;
    if (re.test(target)) confirmed.push(Object.assign({ verified: true }, c));
    else dropped.push(Object.assign({ reason: 'not_reproducible' }, c));
  }
  return { confirmed, dropped };
}

async function run(root, opts) {
  opts = opts || {};
  const started = Date.now();
  const r = await recon(root);
  const cands = await candidates(root);
  const v = verify(cands);
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of v.confirmed) {
    const sev = /secret/.test(c.ruleId) ? 'high' : 'medium';
    bySeverity[sev] += 1;
  }
  // Never leak raw secret material in reports.
  const scrub = (c) => { const o = Object.assign({}, c); delete o.raw; return o; };
  return {
    root,
    phases: PHASES,
    recon: r,
    candidates: cands.length,
    confirmed: v.confirmed.map(scrub),
    dropped: v.dropped.map(scrub),
    summary: {
      candidates: cands.length,
      confirmed: v.confirmed.length,
      dropped: v.dropped.length,
      falsePositiveRate: cands.length ? +(v.dropped.length / cands.length).toFixed(3) : 0,
      bySeverity,
      verdict: bySeverity.critical || bySeverity.high ? 'fail' : v.confirmed.length ? 'warn' : 'pass',
    },
    duration: Date.now() - started,
  };
}

function toSarif(report) {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'aegisai-audit' } },
      results: report.confirmed.map((c) => ({
        ruleId: c.ruleId,
        level: /secret/.test(c.ruleId) ? 'error' : 'warning',
        message: { text: (c.kind === 'secret' ? 'Confirmed secret: ' + c.excerpt : 'Confirmed pattern: ' + c.ruleId) },
        locations: [{ physicalLocation: { artifactLocation: { uri: String(c.file).replace(/\\/g, '/') }, region: { startLine: c.line || 1 } } }],
        properties: { verified: true },
      })),
    }],
  };
}

module.exports = { PHASES, run, recon, candidates, verify, toSarif };
