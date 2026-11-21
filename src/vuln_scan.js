// src/vuln_scan.js
// Local-only heuristic vulnerability scanner for source code (no network, no data egress).
const fs = require('fs');
const path = require('path');

const PATTERNS = [
  { re: /\beval\s*\(|new Function\s*\(/i, severity: 'high', label: 'dynamic code execution' },
  { re: /\b(exec|system|popen)\s*\(/i, severity: 'high', label: 'shell execution' },
  { re: /shell\s*=\s*True/i, severity: 'medium', label: 'shell=True' },
  { re: /(api[_-]?key|secret|password)\s*[:=]\s*["'][^"']{8,}["']/i, severity: 'high', label: 'hardcoded secret' },
  { re: /SELECT\s+.*\+\s*\w+/i, severity: 'medium', label: 'SQL string concatenation' },
  { re: /md5\s*\(|sha1\s*\(/i, severity: 'low', label: 'weak hash' },
  { re: /verify\s*=\s*false|rejectUnauthorized\s*:\s*false/i, severity: 'medium', label: 'TLS verification disabled' },
];
const EXT = /\.(js|ts|py|go|rs|java|php|rb)$/i;

function scan(root, opts) {
  root = root || process.cwd();
  opts = opts || {};
  const findings = [];
  let files = 0;
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (['node_modules', '.git', 'data', 'dist'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (EXT.test(e.name) && files < (opts.maxFiles || 500)) {
        files += 1;
        let text;
        try { text = fs.readFileSync(p, 'utf8'); } catch (err) { continue; }
        text.split(/\r?\n/).forEach((line, i) => {
          for (const pat of PATTERNS) {
            if (pat.re.test(line)) findings.push({ file: path.relative(root, p), line: i + 1, severity: pat.severity, label: pat.label, code: line.trim().slice(0, 120) });
          }
        });
      }
    }
  }
  walk(root);
  return { files, findings, counts: findings.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {}) };
}

module.exports = { scan, PATTERNS };
