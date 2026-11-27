const { test } = require('node:test');
const assert = require('node:assert');
const aegisSkills = require('../src/aegis_skills');
const defaultSkills = require('../src/default_skills');

test('aegis_skills: submodule is available', () => {
  if (!aegisSkills.aegisAvailable()) {
    console.log('SKIP: Aegis submodule not available in this environment');
    return;
  }
  assert.ok(aegisSkills.aegisAvailable(), 'Aegis submodule should be available');
});

test('aegis_skills: lists Aegis skills', () => {
  if (!aegisSkills.aegisAvailable()) { console.log('SKIP: Aegis submodule not available'); return; }
  const skills = aegisSkills.listAegisSkills();
  assert.ok(Array.isArray(skills));
  assert.ok(skills.length > 20, `Expected 20+ skills, got ${skills.length}`);
  assert.ok(skills.includes('first-principles-review'));
  assert.ok(skills.includes('verification-before-completion'));
});

test('aegis_skills: reads a single skill', () => {
  const skill = aegisSkills.readAegisSkill('first-principles-review');
  assert.ok(skill);
  assert.equal(skill.name, 'first-principles-review');
  assert.ok(skill.description.length > 0);
  assert.ok(skill.body.length > 100);
  assert.equal(skill.source, 'aegis');
});

test('aegis_skills: bundled skills include high-value ones', () => {
  const bundled = aegisSkills.BUNDLED_AEGIS_SKILLS;
  assert.ok(bundled.includes('verification-before-completion'));
  assert.ok(bundled.includes('first-principles-review'));
  assert.ok(bundled.includes('systematic-debugging'));
  assert.ok(bundled.length >= 20);
});

test('default_skills: includes Aegis skills when available', () => {
  const list = defaultSkills.list();
  const names = list.map(s => s.name);
  if (aegisSkills.aegisAvailable()) {
    assert.ok(names.includes('verification-before-completion'), 'Should include verification-before-completion');
    assert.ok(names.includes('first-principles-review'), 'Should include first-principles-review');
    assert.ok(names.includes('systematic-debugging'), 'Should include systematic-debugging');
  }
  // Original skills still present
  assert.ok(names.includes('search-before-re'));
  assert.ok(names.includes('pr-review'));
});

test('default_skills: installAll writes Aegis skills', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const tmpDir = path.join(os.tmpdir(), 'aegis-test-' + Date.now());
  const origDataDir = process.env.AEGIS_DATA_DIR;
  process.env.AEGIS_DATA_DIR = tmpDir;
  try {
    const { DATA_DIR } = require('../src/core/config');
    const count = defaultSkills.installAll();
    const minCount = aegisSkills.aegisAvailable() ? 20 : 5;
    assert.ok(count >= minCount, `Expected ${minCount}+ skills installed, got ${count}`);
    const files = fs.readdirSync(path.join(DATA_DIR, 'skills'));
    // Source installs may not initialize git submodules; only assert the
    // Aegis skill file exists when the submodule is actually available.
    if (aegisSkills.aegisAvailable()) {
      assert.ok(files.some(f => f.includes('verification-before-completion')));
    }
  } finally {
    process.env.AEGIS_DATA_DIR = origDataDir;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
});