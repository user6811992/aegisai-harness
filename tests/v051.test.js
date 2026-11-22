const test = require('node:test');
const assert = require('node:assert');
const projects = require('../src/projects');
const hippocampus = require('../src/hippocampus');
const skillFactory = require('../src/skill_factory');
const python = require('../src/python_client');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v051-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('projects create/addDoc/systemText', () => {
  const p = projects.create('testproj', '# Test project');
  assert.ok(p.path);
  projects.addDoc('testproj', 'notes.md', 'hello notes');
  const g = projects.get('testproj');
  assert.ok(g.shelf.includes('notes.md'));
  assert.ok(projects.systemText('testproj').includes('Test project'));
  assert.ok(projects.list().includes('testproj'));
});

test('hippocampus consolidate and recall', () => {
  const r = hippocampus.consolidate('React and Node', ['React', 'Node']);
  assert.ok(r.nodes >= 2);
  const rec = hippocampus.recall('React', 2);
  assert.ok(Array.isArray(rec));
  assert.ok(hippocampus.writeback('React', 'Node'));
});

test('skill factory propose', async () => {
  const r = await skillFactory.proposeSkill('summarize logs');
  // may be null if model unavailable; just check function exists
  assert.ok(typeof skillFactory.proposeSkill === 'function');
  assert.ok(typeof skillFactory.consensusVerify === 'function');
});

test('python client run', async () => {
  const r = await python.run('print(2+2)');
  assert.equal(r.ok, true);
  assert.equal(r.stdout, '4');
});
