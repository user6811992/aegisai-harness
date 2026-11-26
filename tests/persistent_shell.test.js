const test = require('node:test');
const assert = require('node:assert');
const ps = require('../src/persistent_shell');

test('persistent shell runs a command', async () => {
  const r = await ps.exec('echo hello-persistent');
  assert.ok(r.ok);
  assert.match(r.output, /hello-persistent/);
  ps.stop();
});

test('persistent shell tracks running state', () => {
  ps.start();
  assert.equal(ps.isRunning(), true);
  ps.stop();
  assert.equal(ps.isRunning(), false);
});
