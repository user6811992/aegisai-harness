const test = require('node:test');
const assert = require('node:assert');
const dag = require('../src/dag');

test('DAG waves order dependencies', () => {
  const waves = dag.waves([
    { id: 'a', prompt: 'a' },
    { id: 'b', prompt: 'b', deps: ['a'] },
    { id: 'c', prompt: 'c', deps: ['a'] },
    { id: 'd', prompt: 'd', deps: ['b', 'c'] },
  ]);
  assert.deepEqual(waves.map((w) => w.map((n) => n.id)), [['a'], ['b', 'c'], ['d']]);
});

test('DAG detects cycles', () => {
  assert.throws(() => dag.waves([{ id: 'a', deps: ['b'] }, { id: 'b', deps: ['a'] }]), /cycle/);
});

test('DAG detects unknown deps', () => {
  assert.throws(() => dag.waves([{ id: 'a', deps: ['missing'] }]), /unknown dependency/);
});
