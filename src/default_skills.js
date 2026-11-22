// src/default_skills.js
// Bundled default skill pack (mirrors aegisai-next default skills).
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
};
function list() { return Object.values(SKILLS).map((s) => ({ name: s.name, description: s.description })); }
function get(name) { return SKILLS[name] || Object.values(SKILLS).find((s) => s.name === name) || null; }
function installAll() {
  const fs = require('fs'); const path = require('path'); const { DATA_DIR } = require('./core/config');
  const dir = path.join(DATA_DIR, 'skills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of Object.values(SKILLS)) fs.writeFileSync(path.join(dir, s.name + '.md'), '---\nname: ' + s.name + '\ndescription: ' + s.description + '\n---\n\n' + s.body);
  return Object.keys(SKILLS).length;
}

module.exports = { SKILLS, list, get, installAll };
