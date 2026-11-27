const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const conf = JSON.parse(fs.readFileSync(path.join(root, 'packaging', 'tauri', 'tauri.conf.json'), 'utf8'));
const rust = fs.readFileSync(path.join(root, 'packaging', 'tauri', 'src', 'lib.rs'), 'utf8');

test('tauri: resources use explicit targets, not ../.. escaping', () => {
  const res = conf.bundle.resources;
  assert.ok(res && typeof res === 'object' && !Array.isArray(res), 'resources must be a source→target map');
  const expected = {
    '../../src': 'src',
    '../../public': 'public',
    '../../scripts': 'scripts',
    '../../package.json': 'package.json',
    '../../README.md': 'README.md',
    '../../LICENSE': 'LICENSE',
    '../../THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
  };
  assert.deepEqual(Object.keys(res).sort(), Object.keys(expected).sort());
  for (const [source, target] of Object.entries(expected)) assert.equal(res[source], target);
  for (const target of Object.values(res)) assert.ok(!target.includes('_up_'), 'target must not use _up_ nesting');
});

test('tauri: launcher recognizes legacy _up_/_up_ resource layout', () => {
  assert.ok(rust.includes('dir.join("_up_").join("_up_")'), 'resource dir fallback missing');
  assert.ok(rust.includes('let legacy = dir.join("_up_").join("_up_")'), 'exe dir fallback missing');
  assert.ok(rust.includes('candidate.join("src").join("index.js").exists()'), 'resource candidate check missing');
});

test('tauri: dev/build commands still reference the harness entry point', () => {
  assert.equal(conf.build.beforeDevCommand, 'node ../../src/index.js --web');
  assert.deepEqual(conf.bundle.windows.nsis.installMode, 'currentUser');
});
