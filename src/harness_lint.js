// src/harness_lint.js
// Lint/review/security-audit the harness itself.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const REQUIRED = ['package.json', 'README.md', 'ROADMAP.md', 'src/index.js', 'src/agent/run.js', 'public/index.html', 'tests/dag.test.js'];

function lint() {
  const findings = [];
  for (const f of REQUIRED) {
    if (!fs.existsSync(path.join(ROOT, f))) findings.push({ level: 'error', msg: 'missing required file: ' + f });
  }
  // module load check
  const srcDir = path.join(ROOT, 'src');
  const mods = [];
  if (fs.existsSync(srcDir)) {
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(dir, e.name));
        else if (e.name.endsWith('.js') && e.name !== 'index.js') mods.push(path.relative(srcDir, path.join(dir, e.name)));
      }
    };
    walk(srcDir);
  }
  for (const m of mods) {
    try { require(path.join(srcDir, m)); }
    catch (e) { findings.push({ level: 'error', msg: 'module fails to load: ' + m + ' — ' + String(e.message || e) }); }
  }
  // stub scan
  const scanDirs = [path.join(ROOT, 'src')];
  for (const d of scanDirs) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      if (!fs.statSync(fp).isFile() || !f.endsWith('.js')) continue;
      const text = fs.readFileSync(fp, 'utf8');
      if (/external tool not wired|TODO implement|not implemented/i.test(text)) findings.push({ level: 'warning', msg: 'stub/TODO in ' + f });
    }
  }
  // security posture
  if (!fs.existsSync(path.join(ROOT, 'src', 'core', 'security.js'))) findings.push({ level: 'warning', msg: 'no security module' });
  if (!fs.existsSync(path.join(ROOT, 'src', 'guardrails.js'))) findings.push({ level: 'warning', msg: 'no guardrails module' });
  // test presence
  const tests = fs.existsSync(path.join(ROOT, 'tests')) ? fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')) : [];
  if (tests.length < 3) findings.push({ level: 'warning', msg: 'few tests: ' + tests.length });
  return { ok: findings.filter((f) => f.level === 'error').length === 0, findings, modules: mods.length, tests: tests.length };
}

module.exports = { lint };
