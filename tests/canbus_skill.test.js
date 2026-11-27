const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const canbus = require('../src/canbus_skill');
const defaultSkills = require('../src/default_skills');

test('canbus: skill has frontmatter-ready fields', () => {
  const s = canbus.skill();
  assert.equal(s.name, 'canbus-re');
  assert.ok(s.description.length > 20);
  assert.ok(s.body.length > 500);
});

test('canbus: BODY contains all task types', () => {
  for (const t of ['sniff', 'decode', 'inject', 'logformats', 'interfaces', 'isotp', 'uds', 'gmlan']) {
    assert.ok(canbus.BODY.includes('### ' + t), 'missing task: ' + t);
  }
});

test('canbus: BODY emphasizes safety and no-new-tools', () => {
  assert.ok(canbus.BODY.includes('Known traps'));
  assert.ok(canbus.BODY.includes('No new tools are registered'));
  assert.ok(canbus.BODY.toLowerCase().includes('never inject on a live bus'));
});

test('canbus: detectTask identifies tasks', () => {
  assert.equal(canbus.detectTask('decode a DBC signal'), 'decode');
  assert.equal(canbus.detectTask('inject a cansend frame'), 'inject');
  assert.equal(canbus.detectTask('UDS diagnostics 7e0'), 'uds');
  assert.equal(canbus.detectTask('wireshark pcap log'), 'logformats');
  assert.equal(canbus.detectTask('can0 bitrate 500000'), 'interfaces');
  assert.equal(canbus.detectTask('GM seed key CRC Nissan'), 'gmlan');
  assert.equal(canbus.detectTask('sniff the bus'), 'sniff');
});

test('canbus: reconFor returns commands for task', () => {
  const r = canbus.reconFor('decode with cantools');
  assert.equal(r.type, 'decode');
  assert.ok(r.commands.length > 0);
  assert.ok(r.commands.some((c) => c.includes('cantools')));
  assert.equal(r.traps.length, canbus.TRAPS.length);
});

test('canbus: reconFor unknown task falls back to sniff', () => {
  const r = canbus.reconFor('something random');
  assert.equal(r.type, 'sniff');
  assert.ok(r.commands.some((c) => c.includes('candump')));
});

test('canbus: availableCommands returns boolean map with can0', () => {
  const c = canbus.availableCommands();
  assert.ok('candump' in c);
  assert.ok('cantools' in c);
  assert.ok('can0' in c);
  assert.equal(typeof c.can0, 'boolean');
});

test('canbus: install writes SKILL.md to data dir', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const tmp = path.join(os.tmpdir(), 'aegisai-canbus-' + Date.now());
  process.env.AEGISAI_DATA_DIR = tmp;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/canbus_skill');
    const r = fresh.install();
    assert.equal(r.ok, true);
    assert.ok(fs.existsSync(r.path));
    const content = fs.readFileSync(r.path, 'utf8');
    assert.ok(content.startsWith('---'));
    assert.ok(content.includes('name: canbus-re'));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});

test('canbus: bundled in default skills', () => {
  const s = defaultSkills.get('canbus-re');
  assert.ok(s);
  assert.equal(s.name, 'canbus-re');
  assert.ok(s.body.length > 500);
});

test('canbus: MCP tools exposed and dispatch works', () => {
  const names = canbus.tools().map((t) => t.name);
  assert.deepEqual(names, ['canbus_recon', 'canbus_skill']);
  assert.equal(canbus.dispatch('canbus_recon', { task: 'UDS' }).type, 'uds');
  assert.equal(canbus.dispatch('canbus_skill', {}).name, 'canbus-re');
});
