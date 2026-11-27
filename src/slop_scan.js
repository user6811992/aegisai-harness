// src/slop_scan.js
// Anti-slop scanner — clean-room adaptation of 0xNyk/unmachined (MIT).
// Deterministic scanners with severity-tiered findings for prose and UI tells.
// No dependencies, no network. A passing scan is a FLOOR, not proof of quality.
const fs = require('fs');

const TEXT_RULES = [
  { id: 'vague-opening', severity: 'medium', re: /\b(in today's .{0,30}landscape|in the ever-evolving|in the fast-paced world)\b/i, note: 'replace with a concrete observation' },
  { id: 'buzzword', severity: 'high', re: /\b(game[- ]changer|cutting[- ]edge|revolutionary|seamless|robust|leverage|synergy|unlock|empower)\b/i, note: 'state what it actually does' },
  { id: 'empty-intensifier', severity: 'low', re: /\b(very|really|truly|simply|just|basically)\s+(?:important|good|great|powerful|amazing)\b/i, note: 'remove or give evidence' },
  { id: 'hedge-stack', severity: 'medium', re: /\b(might possibly|could potentially|arguably arguably|perhaps maybe)\b/i, note: 'commit to one claim' },
  { id: 'triple-adj', severity: 'low', re: /\b(?:\w+,\s*){2}\w+\s+(?:and|or)\s+\w+/g, note: 'reduce adjective stacking' },
  { id: 'marketing-close', severity: 'high', re: /\b(take it to the next level|the possibilities are endless|stay tuned|reach out to learn more)\b/i, note: 'end with a concrete next step' },
  { id: 'ai-self-reference', severity: 'medium', re: /\b(as an ai|as a language model|i hope this helps|great question!)\b/i, note: 'answer directly' },
  { id: 'rule-of-three', severity: 'low', re: /\b(fast, reliable, and|simple, powerful, and|secure, scalable, and)/i, note: 'replace with specifics' },
];

const UI_RULES = [
  { id: 'generic-gradient', severity: 'medium', re: /(?:(?:linear|radial)-gradient\s*\([^)]*(?:#[0-9a-f]{3,8}|purple|blue|pink)|bg-gradient-(?:to|from)[-\w]*|from-(?:purple|blue|pink|fuchsia|violet)-\d{3})/i, note: 'use a deliberate palette or flat color' },
  { id: 'card-everything', severity: 'low', re: /class\s*=\s*["'][^"']*\bcard\b[^"']*["']/i, note: 'vary structure; not everything is a card' },
  { id: 'rounded-xl', severity: 'low', re: /\brounded-(?:xl|2xl|3xl)\b/i, note: 'check visual direction before defaulting to large radii' },
  { id: 'shadow-heavy', severity: 'low', re: /\bshadow-(?:xl|2xl)\b/i, note: 'prefer borders/spacing for hierarchy' },
];

function scanText(text, opts) {
  opts = opts || {};
  const findings = [];
  for (const rule of TEXT_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    let m;
    while ((m = re.exec(String(text || '')))) {
      findings.push({ rule: rule.id, severity: rule.severity, match: m[0], index: m.index, note: rule.note });
      if (findings.length >= (opts.maxFindings || 200)) break;
    }
  }
  const words = (String(text || '').match(/[a-zA-Z0-9_]+/g) || []).length;
  const score = findings.reduce((a, f) => a + (f.severity === 'high' ? 15 : f.severity === 'medium' ? 8 : 3), 0);
  const threshold = opts.threshold || 40;
  return { ok: true, findings, score, threshold, pass: score < threshold, words, note: 'passing scan is a floor, not proof of quality' };
}

function scanUi(source, opts) {
  const findings = [];
  for (const rule of UI_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    let m;
    while ((m = re.exec(String(source || '')))) {
      findings.push({ rule: rule.id, severity: rule.severity, match: m[0].slice(0, 80), note: rule.note });
      if (findings.length >= 100) break;
    }
  }
  const score = findings.reduce((a, f) => a + (f.severity === 'medium' ? 8 : 3), 0);
  return { ok: true, findings, score, pass: score < (opts && opts.threshold || 40) };
}

function scanFile(filePath, opts) {
  try { return scanText(fs.readFileSync(filePath, 'utf8'), opts); }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// Bounded rewrite loop guidance: stop once concrete and scan passes.
function rewriteLoop(opts) {
  return {
    ok: true,
    steps: [
      'Protect the facts — never rewrite away specifics',
      'Revise the claim with evidence',
      'Re-run the scanner',
      'Stop once the scan passes and the text is concrete',
    ],
    maxRounds: (opts && opts.maxRounds) || 3,
    note: 'more polishing can erase useful specificity',
  };
}

function tools() {
  return [
    { name: 'slop_scan_text', description: 'Scan prose for AI tells with severity-tiered findings.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, threshold: { type: 'number' } }, required: ['text'] } },
    { name: 'slop_scan_ui', description: 'Scan UI source for generic design tells.', inputSchema: { type: 'object', properties: { source: { type: 'string' } }, required: ['source'] } },
    { name: 'slop_rewrite_loop', description: 'Get the bounded anti-slop rewrite procedure.', inputSchema: { type: 'object' } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'slop_scan_text') return scanText(args.text, args);
  if (name === 'slop_scan_ui') return scanUi(args.source, args);
  if (name === 'slop_scan_file') return scanFile(args.path, args);
  if (name === 'slop_rewrite_loop') return rewriteLoop(args);
  throw new Error('unknown slop_scan tool: ' + name);
}

module.exports = { TEXT_RULES, UI_RULES, scanText, scanUi, scanFile, rewriteLoop, tools, dispatch };
