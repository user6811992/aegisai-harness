const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scan } = require('../src/model_discovery');

test('split GGUF shards are grouped into one model entry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-split-'));
  try {
    fs.writeFileSync(path.join(dir, 'gemma-00001-of-00002.gguf'), Buffer.alloc(1024));
    fs.writeFileSync(path.join(dir, 'gemma-00002-of-00002.gguf'), Buffer.alloc(2048));
    const found = scan([dir], 100, 'llamacpp').filter((m) => m.name.startsWith('gemma-'));
    assert.equal(found.length, 1);
    assert.match(found[0].path, /00001-of-00002\.gguf$/);
    assert.equal(found[0].split.index, 1);
    assert.equal(found[0].split.total, 2);
    assert.equal(found[0].split.shards.length, 2);
    assert.equal(typeof found[0].sizeGB, 'number');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a lone second shard is not silently dropped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-split-'));
  try {
    fs.writeFileSync(path.join(dir, 'lone-00002-of-00002.gguf'), Buffer.alloc(512));
    const found = scan([dir], 100, 'llamacpp').filter((m) => m.name.startsWith('lone-'));
    assert.equal(found.length, 1);
    assert.equal(found[0].split, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
