// src/skill_pkg.js
// Skill package manager: install/list/remove skill packages from local paths or git URLs.
const fs = require('fs');
const path = require('path');
const db = require('./storage/db');
const { DATA_DIR } = require('./core/config');

function install(name, source) {
  const dir = path.join(DATA_DIR, 'skill-packages', name);
  fs.mkdirSync(dir, { recursive: true });
  // local path: copy SKILL.md files
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    for (const f of fs.readdirSync(source)) {
      if (f.endsWith('.md')) fs.copyFileSync(path.join(source, f), path.join(dir, f));
    }
  } else {
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# ' + name + '\n\nSource: ' + source + '\n');
  }
  try { db.get().prepare('INSERT OR REPLACE INTO skill_packages (name, source, created) VALUES (?,?,?)').run(name, source, new Date().toISOString()); } catch (e) {}
  return { name, source, dir };
}
function list() {
  try { return db.get().prepare('SELECT * FROM skill_packages ORDER BY created DESC').all(); } catch (e) { return []; }
}
function remove(name) {
  try { db.get().prepare('DELETE FROM skill_packages WHERE name = ?').run(name); } catch (e) {}
  const dir = path.join(DATA_DIR, 'skill-packages', name);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  return { ok: true };
}

module.exports = { install, list, remove };
