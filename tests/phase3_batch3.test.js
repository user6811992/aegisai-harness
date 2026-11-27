const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mr = require('../src/mcp_registry');
const classroom = require('../src/classroom');
const asr = require('../src/asr_pipeline');
const osint = require('../src/osint_aggregator');

test('mcp_registry: list/register/search/resolve', () => {
  assert.ok(mr.list().some(s => s.name === 'aegisai'));
  assert.equal(mr.register('test', { transport: 'stdio', local: true }).ok, true);
  assert.equal(mr.resolve('test').transport, 'stdio');
  assert.equal(mr.resolve('nope').ok, false);
  assert.ok(mr.search('aegis').servers.length > 0);
});
test('mcp_registry: remote disabled offline', () => {
  const prev = process.env.AEGISAI_OFFLINE;
  mr.register('remote-test', { transport: 'http', local: false });
  process.env.AEGISAI_OFFLINE = 'true';
  assert.equal(mr.resolve('remote-test').ok, false);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

test('classroom: session turns and grading', () => {
  const s = classroom.session('Reasoning', { students: [{ name: 'A' }, { name: 'B' }] });
  assert.equal(s.students.length, 2);
  assert.equal(classroom.turn(s, 'teacher', 'Intro').ok, true);
  assert.equal(classroom.turn(s, 'student_1', 'Question').ok, true);
  assert.equal(classroom.turn(s, 'ghost', 'x').ok, false);
  const g = classroom.grade(s, [{ name: 'accuracy', weight: 2, score: 4 }, { name: 'clarity', weight: 1, score: 3 }]);
  assert.equal(g.score, 3.67);
});

test('asr: offline stub aligns and diarizes caller segments', () => {
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  const r = asr.transcribe([{ text: 'hello world', start: 0, end: 1 }], null, ['SPEAKER_01']);
  assert.equal(r.ok, true);
  assert.equal(r.words.length, 2);
  assert.equal(r.words[0].speaker, 'SPEAKER_01');
  assert.equal(asr.available().whisperX, false);
  process.env.AEGISAI_OFFLINE = 'false';
  assert.equal(asr.transcribe([]).ok, false);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

test('osint: opt-in only, plan respects offline', () => {
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  assert.equal(osint.plan('alice').ok, false);
  process.env.AEGISAI_OFFLINE = 'false';
  const r = osint.plan('alice', { sources: ['github'] });
  assert.equal(r.ok, true);
  assert.equal(r.sources.length, 1);
  assert.ok(osint.SOURCES.length >= 5);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

test('lean gate: skip when no Lean project declared + script exists', () => {
  const script = path.join(__dirname, '..', 'scripts', 'lean-gate.js');
  assert.ok(fs.existsSync(script));
  const out = require('child_process').execFileSync(process.execPath, [script], { encoding: 'utf8' });
  assert.ok(out.includes('gate skipped'));
});
test('lean gate: wired into CI', () => {
  const wf = fs.readFileSync(path.join(__dirname,'..','.github','workflows','harness-check.yml'),'utf8');
  assert.ok(wf.includes('scripts/lean-gate.js'));
});

test('phase3: new skills bundled and installable', () => {
  const defs = require('../src/default_skills');
  for (const s of ['vault-notes-chat','react-component-build','open-formats-canvas','rea-mcp-reference']) {
    const skill = defs.get(s);
    assert.ok(skill, s + ' not bundled');
    assert.ok(skill.description && skill.body, s + ' missing fields');
  }
  // installAll() writes bundled skills to the local (gitignored) data/skills dir.
  const prev = process.env.AEGISAI_DATA_DIR;
  const root = path.join(os.tmpdir(), 'aegisai-skill-' + Date.now());
  process.env.AEGISAI_DATA_DIR = root;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/default_skills');
    const count = fresh.installAll();
    assert.ok(count >= 4);
    assert.ok(fs.existsSync(path.join(root, 'skills', 'rea-mcp-reference.md')));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
  }
});

test('phase3b3: tools registered', () => {
  const mcp = fs.readFileSync(path.join(__dirname,'..','src','mcp_server.js'),'utf8');
  for (const t of ['mcp_registry','classroom','asr_pipeline','osint_aggregator']) assert.ok(mcp.includes(`./${t}`));
});
