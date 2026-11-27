// src/aegis_skills.js
// Aegis skill pack integration. Reads skills from the vendored Aegis submodule
// (vendor/aegis/skills/) and imports them into the skill store. Also exposes
// a subset of high-value skills as bundled defaults.
const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./skills_import');

const AEGIS_SKILLS_DIR = path.join(__dirname, '..', 'vendor', 'aegis', 'skills');

// High-value skills to bundle as defaults (cherry-picked from Aegis).
const BUNDLED_AEGIS_SKILLS = [
  'first-principles-review',
  'verification-before-completion',
  'systematic-debugging',
  'long-task-continuation',
  'dispatching-parallel-agents',
  'test-driven-development',
  'receiving-code-review',
  'requesting-code-review',
  'writing-plans',
  'executing-plans',
  'establishing-project-context',
  'goal-framing',
  'brainstorming',
  'writing-skills',
  'using-git-worktrees',
  'finishing-a-development-branch',
  'recording-architecture-decisions',
  'communicating-concisely',
  'anti-entropy-governance',
  'ui-ux-governance',
  'subagent-driven-development',
];

function aegisAvailable() {
  try { return fs.existsSync(AEGIS_SKILLS_DIR) && fs.statSync(AEGIS_SKILLS_DIR).isDirectory(); }
  catch (e) { return false; }
}

function listAegisSkills() {
  if (!aegisAvailable()) return [];
  return fs.readdirSync(AEGIS_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(AEGIS_SKILLS_DIR, name, 'SKILL.md')));
}

function readAegisSkill(name) {
  const skillPath = path.join(AEGIS_SKILLS_DIR, name, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  const text = fs.readFileSync(skillPath, 'utf8');
  const { meta, body } = parseFrontmatter(text);
  return {
    name: meta.name || name,
    description: meta.description || '',
    body: body.trim(),
    source: 'aegis',
    path: skillPath,
  };
}

function importAegisSkills(db) {
  if (!aegisAvailable()) return { ok: false, reason: 'aegis submodule not found', count: 0 };
  const skills = listAegisSkills();
  let count = 0;
  for (const name of skills) {
    const skill = readAegisSkill(name);
    if (!skill) continue;
    try {
      db.get().prepare('INSERT OR REPLACE INTO skills (name, description, code, created, updated) VALUES (?,?,?,?,?)')
        .run(skill.name, skill.description, skill.body, new Date().toISOString(), new Date().toISOString());
      count++;
    } catch (e) { /* skip on error */ }
  }
  return { ok: true, count, total: skills.length };
}

// Read a single bundled skill (for default_skills.js integration).
function getBundledSkill(name) {
  return readAegisSkill(name);
}

module.exports = {
  AEGIS_SKILLS_DIR,
  BUNDLED_AEGIS_SKILLS,
  aegisAvailable,
  listAegisSkills,
  readAegisSkill,
  importAegisSkills,
  getBundledSkill,
};