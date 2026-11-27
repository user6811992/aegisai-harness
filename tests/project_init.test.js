const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { detectProjectType, getTestCommand, initProject } = require('../src/project_init');

test('project_init: detectProjectType node', () => {
  const dir = path.join(os.tmpdir(), 'pi-node-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  assert.equal(detectProjectType(dir), 'node');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project_init: detectProjectType python', () => {
  const dir = path.join(os.tmpdir(), 'pi-py-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '');
  assert.equal(detectProjectType(dir), 'python');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project_init: detectProjectType rust', () => {
  const dir = path.join(os.tmpdir(), 'pi-rs-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Cargo.toml'), '');
  assert.equal(detectProjectType(dir), 'rust');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project_init: detectProjectType generic', () => {
  const dir = path.join(os.tmpdir(), 'pi-gen-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  assert.equal(detectProjectType(dir), 'generic');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project_init: getTestCommand', () => {
  assert.equal(getTestCommand('node'), 'npm test');
  assert.equal(getTestCommand('python'), 'pytest');
  assert.equal(getTestCommand('rust'), 'cargo test');
  assert.equal(getTestCommand('generic'), 'echo "no test command configured"');
});

test('project_init: initProject creates files', () => {
  const dir = path.join(os.tmpdir(), 'pi-init-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  const result = initProject(dir);
  assert.equal(result.ok, true);
  assert.ok(result.created.includes('AGENTS.md'));
  assert.ok(result.created.includes('.mcp.json'));
  assert.ok(result.created.includes('.aegisai/project.json'));
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(dir, '.mcp.json')));
  assert.ok(fs.existsSync(path.join(dir, '.aegisai', 'project.json')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project_init: initProject skips existing files', () => {
  const dir = path.join(os.tmpdir(), 'pi-skip-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'existing');
  const result = initProject(dir);
  assert.ok(result.skipped.includes('AGENTS.md (already exists)'));
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'existing');
  fs.rmSync(dir, { recursive: true, force: true });
});