const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mf = require('../src/model_fit');
const wf = require('../src/workflow_yaml');

// #192 — split GGUF shards must be summed for VRAM/RAM estimates.
test('#192: readGgufMeta sums all split shards', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-gguf-'));
  const base = path.join(dir, 'model-q4_k_m');
  const names = [1, 2].map((i) => `${base}-${String(i).padStart(5, '0')}-of-00002.gguf`);
  for (const n of names) {
    const buf = Buffer.alloc(512);
    buf.write('GGUF', 0, 'ascii');
    buf.writeUInt32LE(3, 4);
    fs.writeFileSync(n, buf);
  }
  try {
    const meta = mf.readGgufMeta(names[0]);
    assert.equal(meta.ok, true);
    assert.equal(meta.bytes, 1024);
    assert.equal(meta.shards, 2);
    assert.deepEqual(meta.split, { index: 1, total: 2 });
    assert.equal(mf.estimate(names[0], { context: 4096 }).fileGB, meta.sizeGB);
    // Pointing at shard 2 must yield the same total.
    assert.equal(mf.readGgufMeta(names[1]).bytes, 1024);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('#192: non-split GGUF unaffected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-gguf-'));
  const p = path.join(dir, 'single.gguf');
  const buf = Buffer.alloc(256); buf.write('GGUF', 0, 'ascii'); buf.writeUInt32LE(3, 4);
  fs.writeFileSync(p, buf);
  try {
    const meta = mf.readGgufMeta(p);
    assert.equal(meta.bytes, 256);
    assert.equal(meta.shards, 1);
    assert.equal(meta.split, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// #193 — inline arrays and scalar values in `on:`.
test('#193: inline array and scalar on: triggers parse and gate', () => {
  const inline = wf.parse('name: demo\non: [push, pull_request]\nsteps:\n  - run: echo hi');
  assert.deepEqual(inline.on, ['push', 'pull_request']);
  assert.equal(wf.run(inline, 'pull_request').ok, true);
  assert.equal(wf.run(inline, 'release').ok, false);

  const scalar = wf.parse("name: demo\non: 'push'\nsteps:\n  - run: echo hi");
  assert.deepEqual(scalar.on, ['push']);
  assert.equal(wf.run(scalar, 'push').ok, true);
  assert.equal(wf.run(scalar, 'release').ok, false);
});

test('#193: block form still works', () => {
  const w = wf.parse('name: demo\non:\n  - push\n  - release\nsteps:\n  - run: echo hi');
  assert.deepEqual(w.on, ['push', 'release']);
  assert.equal(wf.run(w, 'release').ok, true);
  assert.equal(wf.run(w, 'other').ok, false);
});
