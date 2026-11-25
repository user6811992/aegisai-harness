// src/remediation.js
// Finding → patch proposal → verification loop (strix-style "find and fix").
// Patches are proposed as unified-ish replacements and NEVER applied unless
// `apply: true` is passed explicitly.
const fs = require('fs');
const path = require('path');

// Known-safe mechanical fixes keyed by finding label/rule.
const FIXES = [
  {
    match: /eval|dynamic code/i,
    describe: 'Replace eval() with an explicit parser or JSON.parse.',
    // Conservative: only rewrite `eval(` when the argument is a JSON string literal.
    apply: (text) => text.replace(/\beval\((['"])([\s\S]*?)\1\)/g, (m, q, body) => "JSON.parse('" + body.replace(/'/g, "\\'") + "')"),
  },
  {
    match: /hardcoded|secret|credential/i,
    describe: 'Move the credential to an environment variable and read it at runtime.',
    apply: (text) => text
      .replace(/(?:const|let|var)\s+(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*['"][^'"]{8,}['"]/g,
        (m, name) => 'const ' + name + " = process.env." + name + " || ''"),
  },
  {
    match: /child_process|os\.system|shell/i,
    describe: 'Avoid shell interpolation; use execFile with an argument array.',
    apply: (text) => text.replace(/\bexec\(\s*(['"`])([^'"`]*)\1\s*\)/g, (m, q, cmd) => 'execFile(' + q + cmd.split(' ')[0] + q + ', [])'),
  },
  {
    match: /innerHTML|dangerous/i,
    describe: 'Use textContent or an escaping renderer instead of innerHTML.',
    apply: (text) => text.replace(/\.innerHTML\s*=\s*([^;]+);/g, (m, val) => '.textContent = ' + val.trim() + ';'),
  },
];

function propose(finding, fileText) {
  for (const f of FIXES) {
    const hay = String(finding.label || finding.ruleId || finding.message || '');
    if (f.match.test(hay)) {
      const patched = f.apply(fileText);
      if (patched !== fileText) {
        return { applicable: true, strategy: f.describe, patched };
      }
      return { applicable: false, strategy: f.describe, reason: 'no mechanical rewrite matched' };
    }
  }
  return { applicable: false, reason: 'no known fix strategy for this finding' };
}

/**
 * remediation loop:
 *  1. re-run the probe that produced the finding (injected `probe()`),
 *  2. if still present, propose a patch,
 *  3. apply to a temp copy and re-run the probe,
 *  4. report whether the fix holds.
 */
async function remediate(finding, probe, opts) {
  opts = opts || {};
  const before = await probe();
  if (!before) return { finding, status: 'not_reproducible', applied: false };
  let fileText = '';
  try { fileText = fs.readFileSync(finding.file, 'utf8'); } catch (e) { return { finding, status: 'file_unreadable', applied: false, error: String(e.message || e) }; }
  const prop = propose(finding, fileText);
  if (!prop.applicable) return { finding, status: 'no_fix', applied: false, strategy: prop.strategy, reason: prop.reason };
  const candidate = prop.patched;
  // Verify on a copy: write next to the original, re-probe, then clean up.
  const tmp = finding.file + '.aegisai-fix-' + Date.now() + path.extname(finding.file);
  let holds = false;
  try {
    fs.writeFileSync(tmp, candidate, 'utf8');
    // The probe is expected to accept an alternate file path.
    const after = await probe({ file: tmp, text: candidate });
    holds = !after;
  } catch (e) {
    holds = false;
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
  if (opts.apply && holds) {
    fs.writeFileSync(finding.file, candidate, 'utf8');
    return { finding, status: 'fixed', applied: true, strategy: prop.strategy, verified: true };
  }
  return { finding, status: holds ? 'fix_ready' : 'fix_ineffective', applied: false, strategy: prop.strategy, verified: holds, preview: candidate.slice(0, 400) };
}

module.exports = { FIXES, propose, remediate };
