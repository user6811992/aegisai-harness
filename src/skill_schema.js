// src/skill_schema.js
// Validate SKILL.md against the canonical Agent Skills schema
// (name, description, optional license / allowed-tools / metadata).
const fs = require('fs');
const path = require('path');

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

function parseFrontmatter(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  if (!/^---\s*\r?\n/.test(s)) return { frontmatter: {}, body: s, hasFrontmatter: false };
  const end = s.indexOf('\n---', 3);
  if (end < 0) return { frontmatter: {}, body: s, hasFrontmatter: false };
  const fmText = s.slice(s.indexOf('\n') + 1, end);
  const body = s.slice(s.indexOf('\n', end + 1) + 1);
  // Frontmatter here is flat key: value — sufficient for the spec's required fields.
  const fm = {};
  for (const raw of fmText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    fm[m[1]] = v;
  }
  return { frontmatter: fm, body, hasFrontmatter: true };
}

function validateText(text, opts) {
  opts = opts || {};
  const errors = [];
  const warnings = [];
  const { frontmatter: fm, body, hasFrontmatter } = parseFrontmatter(text);

  if (!hasFrontmatter) {
    errors.push({ field: 'frontmatter', message: 'SKILL.md must start with a YAML frontmatter block delimited by ---' });
    return { ok: false, errors, warnings, frontmatter: fm, body };
  }

  const name = fm.name;
  if (!name) errors.push({ field: 'name', message: 'name is required' });
  else if (typeof name !== 'string' || !NAME_RE.test(name)) {
    errors.push({ field: 'name', message: 'name must be lowercase letters, digits and hyphens (1-63 chars, starting alphanumeric)' });
  }

  const desc = fm.description;
  if (!desc) errors.push({ field: 'description', message: 'description is required' });
  else if (String(desc).length < 16) warnings.push({ field: 'description', message: 'description is very short; agents use it to decide when to load the skill' });
  else if (String(desc).length > 1024) warnings.push({ field: 'description', message: 'description exceeds 1024 characters; most loaders truncate it' });

  if (fm.license != null && typeof fm.license !== 'string') errors.push({ field: 'license', message: 'license must be a string' });

  if (fm['allowed-tools'] != null) {
    const tools = fm['allowed-tools'];
    if (!Array.isArray(tools) && typeof tools !== 'string') errors.push({ field: 'allowed-tools', message: 'allowed-tools must be a list or a space-separated string' });
    const list = Array.isArray(tools) ? tools : String(tools).split(/\s+/).filter(Boolean);
    if (list.includes('*')) warnings.push({ field: 'allowed-tools', message: 'grants every tool (*); prefer an explicit list' });
  }

  if (!String(body || '').trim()) errors.push({ field: 'body', message: 'skill body is empty' });

  // Optional sanity: the body should not start with a duplicate title heading.
  if (name && String(body).trim().startsWith('# ') && !String(body).trim().split('\n')[0].toLowerCase().includes(String(name).toLowerCase())) {
    warnings.push({ field: 'body', message: 'body starts with a heading that does not match the skill name' });
  }

  return { ok: errors.length === 0, errors, warnings, frontmatter: fm, body, name: name || null, description: desc || null };
}

function validateFile(filePath, opts) {
  const text = fs.readFileSync(filePath, 'utf8');
  const r = validateText(text, opts);
  return Object.assign({ file: filePath }, r);
}

// Discover skill directories (a dir is a skill if it contains SKILL.md).
function discover(root) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    const hasSkill = entries.some((e) => e.isFile() && /^skill\.md$/i.test(e.name));
    if (hasSkill) found.push(dir);
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

function validateDir(root) {
  const dirs = discover(root);
  return dirs.map((d) => validateFile(path.join(d, 'SKILL.md')));
}

function summarize(results) {
  const invalid = results.filter((r) => !r.ok);
  return {
    skills: results.length,
    valid: results.length - invalid.length,
    invalid: invalid.length,
    withWarnings: results.filter((r) => (r.warnings || []).length).length,
    verdict: invalid.length ? 'fail' : 'pass',
  };
}

module.exports = { parseFrontmatter, validateText, validateFile, validateDir, discover, summarize, NAME_RE };
