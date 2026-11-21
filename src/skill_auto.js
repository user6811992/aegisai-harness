// src/skill_auto.js
// Auto-create skills from completed agent runs.
const db = require('./storage/db');

function autoCreateSkill(name, toolLog, description) {
  if (!toolLog || toolLog.length === 0) return null;
  const code = '// Auto-generated skill\n// Tools used: ' + toolLog.map((t) => t.name).join(', ') + '\n' +
    'async function run(ctx) {\n  // TODO: implement\n  return { ok: true };\n}\nmodule.exports = { run };\n';
  const skillName = name || ('auto_' + Date.now());
  try {
    db.get().prepare('INSERT OR REPLACE INTO skills (name, description, code, created, updated) VALUES (?,?,?,?,?)')
      .run(skillName, description || 'Auto-generated from agent run', code, new Date().toISOString(), new Date().toISOString());
  } catch (e) {}
  return skillName;
}

module.exports = { autoCreateSkill };
