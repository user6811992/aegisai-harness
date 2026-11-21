const test = require('node:test');
const assert = require('node:assert');
const semantic = require('../src/semantic_tools');
const yamlEval = require('../src/yaml_eval');
const passAtK = require('../src/pass_at_k');
const failureCluster = require('../src/failure_cluster');
const ledger = require('../src/ledger');
const gems = require('../src/gems');
const ahp = require('../src/ahp');
const sarif = require('../src/sarif');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v034-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('semantic tool retrieval', () => {
  const tools = [
    { function: { name: 'read_file', description: 'read a file' } },
    { function: { name: 'run_command', description: 'execute shell command' } },
  ];
  const r = semantic.retrieve(tools, 'execute shell', 1);
  assert.equal(r[0].function.name, 'run_command');
});

test('yaml eval parse', () => {
  const spec = yamlEval.parse('name: sample\ncases:\n  - prompt: say hi\n    expected: hi');
  assert.equal(spec.name, 'sample');
  assert.equal(spec.cases.length, 1);
});

test('pass@k metrics', () => {
  const r = passAtK.compare({ a: [[true, false], [true, true]] });
  assert.ok('pass1' in r.a);
});

test('failure clustering', () => {
  const r = failureCluster.cluster();
  assert.ok(Array.isArray(r.clusters));
});

test('ledger rewind', () => {
  ledger.append('a', { n: 1 });
  const last = ledger.list().slice(-1)[0];
  const r = ledger.rewind(last.seq);
  assert.ok(r.entries > 0);
});

test('gems list', () => {
  assert.ok(Array.isArray(gems.list()));
});

test('AHP supervision', () => {
  const r = ahp.supervise('write_file', { path: 'a' }, { readOnly: true });
  assert.equal(r.allowed, false);
  assert.ok(r.blockedBy);
});

test('SARIF conversion', () => {
  const s = sarif.fromFindings([{ file: 'a.js', line: 3, severity: 'high', label: 'dynamic code execution', code: 'eval()' }]);
  assert.equal(s.version, '2.1.0');
  assert.equal(s.runs[0].results.length, 1);
});
