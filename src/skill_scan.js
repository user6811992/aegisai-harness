// src/skill_scan.js
// Skill/plugin security scanner (SkillSpector-style rule classes) with SARIF output.
// Scans skill/plugin *text* (SKILL.md, manifests, JS) for risky constructs.
const fs = require('fs');
const path = require('path');

const RULES = [
  { id: 'skill/exec-shell', severity: 'high', re: /\b(child_process|execSync|spawnSync|exec\(|spawn\()/g, msg: 'Executes shell commands.' },
  { id: 'skill/network-exfil', severity: 'high', re: /\b(fetch|https?\.request|axios|XMLHttpRequest)\b[^\n]{0,80}(token|key|secret|password|credential)/gi, msg: 'Network call that appears to send credentials.' },
  { id: 'skill/read-secrets', severity: 'high', re: /(\.ssh\/|\bid_rsa\b|\.aws\/credentials|\.npmrc|\.netrc|process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD))/g, msg: 'Reads credential material.' },
  { id: 'skill/eval-dynamic', severity: 'high', re: /\b(eval\(|new Function\(|vm\.runIn)/g, msg: 'Dynamic code evaluation.' },
  { id: 'skill/env-dump', severity: 'medium', re: /\b(JSON\.stringify\(process\.env\)|Object\.entries\(process\.env\)|printenv\b)/g, msg: 'Dumps the whole environment.' },
  { id: 'skill/fs-wide', severity: 'medium', re: /(readdirSync\(['"]\/['"]\)|readFileSync\(['"]\/etc\/|\bglob\(['"]\*\*)/g, msg: 'Broad filesystem access.' },
  { id: 'skill/obfuscation', severity: 'medium', re: /(atob\(|Buffer\.from\([^)]*,\s*['"]base64|\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2})/g, msg: 'Obfuscated payload.' },
  { id: 'skill/prompt-override', severity: 'high', re: /(ignore (all )?(previous|prior) instructions|disregard (the )?system prompt|you are now|new instructions:)/gi, msg: 'Instruction-override language in skill text.' },
  { id: 'skill/hidden-unicode', severity: 'medium', re: /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, msg: 'Hidden or bidi control characters.' },
  { id: 'skill/unbounded-tools', severity: 'low', re: /(allowed-tools:\s*\*|tools:\s*\[?\s*["']?\*)/gi, msg: 'Grants every tool.' },
  { id: 'skill/curl-pipe-sh', severity: 'high', re: /(curl\s+[^\n|]+\|\s*(ba)?sh|wget\s+[^\n|]+\|\s*(ba)?sh)/gi, msg: 'Pipes remote content into a shell.' },
  { id: 'skill/write-outside', severity: 'medium', re: /(writeFileSync\(['"]\/(etc|usr|bin|boot)|\bcrontab\b|\.bashrc|authorized_keys)/g, msg: 'Writes to sensitive system paths or persistence locations.' },
];

function scanText(text, source) {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    let m;
    let guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 200) {
      const idx = m.index;
      const lineNo = text.slice(0, idx).split(/\r?\n/).length;
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.msg,
        source: source || '<inline>',
        line: lineNo,
        excerpt: (lines[lineNo - 1] || '').trim().slice(0, 160),
      });
      if (!rule.re.global) break;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return findings;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return scanText(text, filePath);
}

function scanDir(dir) {
  const out = [];
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
        walk(p);
      } else if (/\.(md|js|mjs|cjs|ts|json|ya?ml|txt)$/i.test(e.name)) {
        try { out.push(...scanFile(p)); } catch (err) {}
      }
    }
  };
  walk(dir);
  return out;
}

function summarize(findings) {
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  return {
    total: findings.length,
    bySeverity,
    verdict: bySeverity.high ? 'fail' : bySeverity.medium ? 'warn' : 'pass',
  };
}

function toSarif(findings) {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'aegisai-skill-scan', rules: RULES.map((r) => ({ id: r.id, shortDescription: { text: r.msg } })) } },
      results: findings.map((f) => ({
        ruleId: f.ruleId,
        level: f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warning' : 'note',
        message: { text: f.message },
        locations: [{ physicalLocation: { artifactLocation: { uri: String(f.source).replace(/\\/g, '/') }, region: { startLine: f.line } } }],
      })),
    }],
  };
}

module.exports = { RULES, scanText, scanFile, scanDir, summarize, toSarif };
