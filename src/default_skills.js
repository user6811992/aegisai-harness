// src/default_skills.js
// Bundled default skill pack (mirrors aegisai-next default skills + Aegis method pack).
const aegisSkills = require('./aegis_skills');
const leanrea = require('./leanrea_skill');
const canbus = require('./canbus_skill');
const lightpanda = require('./lightpanda');
const inferencePlaybook = require('./inference_playbook');

const SKILLS = {
  search_before_re: {
    name: 'search-before-re',
    description: 'Search for existing reverse-engineered work before starting analysis.',
    body: 'Before reverse engineering, search public indexes for existing documentation of the target, product, or protocol. Summarize what is already known.',
  },
  pr_review: {
    name: 'pr-review',
    description: 'Review a pull request diff for correctness and security.',
    body: 'Review the diff. Report concrete issues with file:line references. Check correctness, security, tests, and clarity. Be concise.',
  },
  doc_discipline: {
    name: 'doc-discipline',
    description: 'Keep documentation in sync with code changes.',
    body: 'After code changes, update relevant docs (README, API docs, comments). Do not leave stale examples.',
  },
  context_compress: {
    name: 'context-compress',
    description: 'Compress long context while keeping errors and decisions.',
    body: 'Summarize the conversation, keeping all errors, decisions, and unresolved questions. Drop redundant tool output.',
  },
  design_review: {
    name: 'design-review',
    description: 'Review a design for usability and accessibility.',
    body: 'Review the design for clarity, consistency, accessibility, and edge cases. List actionable improvements.',
  },
  android_re: {
    name: 'android-re',
    description: 'Guide Android APK reverse engineering from observable behavior.',
    body: 'Start from observable behavior. Use jadx/manifest analysis. Avoid copying proprietary source.',
  },
  ui_review: {
    name: 'ui-review',
    description: 'Review UI implementation against a reference.',
    body: 'Compare the implemented UI against the reference. Report layout, spacing, color, and interaction differences.',
  },
  lean_rea: {
    name: leanrea.SKILL_NAME,
    description: leanrea.SKILL_DESCRIPTION,
    body: leanrea.BODY,
  },
  canbus_re: {
    name: canbus.SKILL_NAME,
    description: canbus.SKILL_DESCRIPTION,
    body: canbus.BODY,
  },
  lightpanda: {
    name: lightpanda.SKILL_NAME,
    description: lightpanda.SKILL_DESCRIPTION,
    body: lightpanda.skill().body,
  },
  tune_local_inference: {
    name: inferencePlaybook.SKILL_NAME,
    description: inferencePlaybook.SKILL_DESCRIPTION,
    body: inferencePlaybook.BODY,
  },
};

// Load Aegis bundled skills (from vendored submodule) as defaults.
if (aegisSkills.aegisAvailable()) {
  for (const name of aegisSkills.BUNDLED_AEGIS_SKILLS) {
    const skill = aegisSkills.getBundledSkill(name);
    if (skill) {
      const key = skill.name.replace(/-/g, '_');
      SKILLS[key] = { name: skill.name, description: skill.description, body: skill.body };
    }
  }
}

function list() { return Object.values(SKILLS).map((s) => ({ name: s.name, description: s.description })); }
function get(name) { return SKILLS[name] || Object.values(SKILLS).find((s) => s.name === name) || null; }
function installAll() {
  const fs = require('fs'); const path = require('path'); const { DATA_DIR } = require('./core/config');
  const dir = path.join(DATA_DIR, 'skills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of Object.values(SKILLS)) fs.writeFileSync(path.join(dir, s.name + '.md'), '---\nname: ' + s.name + '\ndescription: ' + s.description + '\n---\n\n' + s.body);
  return Object.keys(SKILLS).length;
}

module.exports = { SKILLS, list, get, installAll };