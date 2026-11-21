// src/skill_eval.js
// Skill/plugin evaluator: quality gates, security scan, harness compatibility, semantic overlap.
const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./skills_import');

const SECURITY_PATTERNS = [
  { re: /curl\s+https?:\/\/|wget\s+https?:\/\//i, label: 'network download' },
  { re: /rm\s+-rf|del\s+\/f\s+\/s/i, label: 'destructive shell' },
  { re: /ignore (all )?(previous|prior) instructions/i, label: 'prompt injection' },
  { re: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, label: 'hardcoded secret' },
  { re: /eval\s*\(|new Function\s*\(/i, label: 'dynamic code execution' },
];

function evaluateFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(text);
  const issues = [];
  const warnings = [];
  // quality gates
  if (!meta.name && !path.basename(filePath, path.extname(filePath))) issues.push('missing skill name');
  if (!meta.description || meta.description.length < 10) warnings.push('description too short or missing');
  if (body.trim().length < 40) warnings.push('thin instructions');
  if (!/##|#\s/.test(body)) warnings.push('no headings in instructions');
  // security
  for (const p of SECURITY_PATTERNS) if (p.re.test(text)) issues.push('security: ' + p.label);
  // compatibility
  if (!text.startsWith('---')) warnings.push('no frontmatter (SKILL.md convention)');
  const score = Math.max(0, 100 - issues.length * 25 - warnings.length * 8);
  return { file: filePath, name: meta.name || path.basename(filePath, path.extname(filePath)), score, passed: issues.length === 0, issues, warnings };
}

function tokenize(text) {
  return new Set((text || '').toLowerCase().match(/[a-z0-9]+/g) || []);
}
function overlap(a, b) {
  const A = tokenize(a), B = tokenize(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return A.size || B.size ? +(inter / (A.size + B.size - inter)).toFixed(3) : 0;
}
function findOverlaps(files, threshold) {
  threshold = threshold || 0.6;
  const out = [];
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      let ta = '', tb = '';
      try { ta = fs.readFileSync(files[i], 'utf8'); tb = fs.readFileSync(files[j], 'utf8'); } catch (e) { continue; }
      const o = overlap(ta, tb);
      if (o >= threshold) out.push({ a: files[i], b: files[j], overlap: o });
    }
  }
  return out;
}

module.exports = { evaluateFile, overlap, findOverlaps, SECURITY_PATTERNS };
