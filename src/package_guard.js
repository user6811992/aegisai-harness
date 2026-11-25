// src/package_guard.js
// Supply-chain guard for install commands: static policy check before running
// `npm install` / `pip install` / `cargo add`, plus a post-install audit helper.
// Never executes anything itself.
const BUILTIN_DENY = [
  'event-stream',        // historical supply-chain incident
  'flatmap-stream',
  'crossenv',
  'd3.js',
  'ffmpeg.js',
  'gatsby-plugin-feed',
  'eslint-scope-3.7.2',
  'http-proxy-middleware@0.18', // compromised release
  'ua-parser-js@0.7.29',
  'coa@2.0.3',
  'rc@1.2.8',
];
const SUSPICIOUS_NAME = /(^|[-_.])(test|malware|backdoor|hack|payload)([-_.]|$)/i;
const TYPOSQUAT_TARGETS = ['react', 'express', 'lodash', 'axios', 'chalk', 'debug', 'typescript', 'webpack', 'eslint', 'prettier', 'vite', 'next', 'vue', 'angular', 'moment', 'request', 'socket.io'];

// Damerau-Levenshtein (adjacent transposition costs 1) — catches `experss`.
function levenshtein(a, b) {
  const m = a.length; const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => { const row = new Array(n + 1).fill(0); row[0] = i; return row; });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function parsePackages(command) {
  const cmd = String(command || '');
  const out = [];
  // npm i pkg@1 / npm install pkg --save
  const npm = /npm\s+(?:i|install|add)\s+([^&|;]+)/i.exec(cmd);
  if (npm) {
    for (const tok of npm[1].split(/\s+/)) {
      if (!tok || tok.startsWith('-')) continue;
      const name = tok.startsWith('@') ? tok.split('@').slice(0, 2).join('@') : tok.split('@')[0];
      const version = tok.includes('@') && !tok.startsWith('@') ? tok.split('@')[1] : (tok.startsWith('@') ? tok.split('@')[2] : null);
      if (name) out.push({ manager: 'npm', name, version: version || null, raw: tok });
    }
  }
  const pip = /pip3?\s+install\s+([^&|;]+)/i.exec(cmd);
  if (pip) {
    for (const tok of pip[1].split(/\s+/)) {
      if (!tok || tok.startsWith('-')) continue;
      const [name, version] = tok.split(/(==|>=|<=|~=)/);
      out.push({ manager: 'pip', name, version: version ? tok.split(/(==|>=|<=|~=)/)[2] : null, raw: tok });
    }
  }
  const cargo = /cargo\s+add\s+([^&|;]+)/i.exec(cmd);
  if (cargo) {
    for (const tok of cargo[1].split(/\s+/)) {
      if (!tok || tok.startsWith('-')) continue;
      out.push({ manager: 'cargo', name: tok.split('@')[0], version: tok.includes('@') ? tok.split('@')[1] : null, raw: tok });
    }
  }
  return out;
}

function checkPackage(pkg) {
  const reasons = [];
  const name = String(pkg.name || '');
  const lower = name.toLowerCase();
  if (BUILTIN_DENY.some((d) => lower === d.split('@')[0] || (d.includes('@') && lower + '@' + (pkg.version || '') === d))) reasons.push('known malicious/compromised package');
  if (SUSPICIOUS_NAME.test(lower)) reasons.push('package name matches a suspicious pattern');
  for (const target of TYPOSQUAT_TARGETS) {
    if (lower !== target && levenshtein(lower, target) === 1) reasons.push('possible typosquat of "' + target + '"');
  }
  if (/^[a-z0-9]{1,2}$/.test(lower)) reasons.push('single/double-character package name (high squatting risk)');
  if (!pkg.version && pkg.manager === 'npm') reasons.push('unpinned version (supply-chain drift risk)');
  return { package: pkg, allowed: reasons.length === 0, reasons };
}

function checkCommand(command, opts) {
  opts = opts || {};
  const pkgs = parsePackages(command);
  const results = pkgs.map(checkPackage);
  const denied = results.filter((r) => !r.allowed);
  return {
    command,
    packages: results,
    decision: denied.length ? 'deny' : (results.length ? 'allow' : 'not-an-install'),
    reasons: denied.flatMap((d) => d.reasons),
    opts: { strict: Boolean(opts.strict) },
  };
}

// Post-install audit: compare lockfile deps against OSV-style advisory list (offline stub).
function auditLockfile(lockPath) {
  const fs = require('fs');
  let data;
  try { data = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch (e) { return { ok: false, error: String(e.message || e) }; }
  const deps = data.packages ? Object.entries(data.packages).filter(([k]) => k).map(([k, v]) => ({ name: k.replace(/^node_modules\//, ''), version: v.version })) : [];
  return { ok: true, packages: deps.length, suspect: deps.filter((d) => checkPackage({ manager: 'npm', name: d.name, version: d.version }).allowed === false) };
}

module.exports = { BUILTIN_DENY, parsePackages, checkPackage, checkCommand, auditLockfile, levenshtein };
