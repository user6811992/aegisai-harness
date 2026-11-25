const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

test('v077: PDF writer produces a valid PDF header and xref', () => {
  const { buildPdf } = require('../src/pdf_writer');
  const buf = buildPdf([{ text: 'Hello', size: 12, bold: true }, { text: 'World body text' }], { title: 'T' });
  const s = buf.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'), 'missing PDF header');
  assert.match(s, /\/Type \/Catalog/);
  assert.match(s, /\/Type \/Pages/);
  assert.match(s, /xref/);
  assert.match(s, /startxref/);
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  assert.ok(buf.length > 400);
});

test('v077: conversation export writes a real PDF file', () => {
  const exp = require('../src/conversation_export');
  const out = path.join(os.tmpdir(), 'aegisai-export-' + Date.now() + '.pdf');
  const r = exp.exportToFile([{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi there' }], { title: 'Chat', model: 'llama3.2:3b', date: '2026-11-25' }, 'pdf', out);
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(out));
  const head = fs.readFileSync(out).slice(0, 8).toString('latin1');
  assert.equal(head, '%PDF-1.4');
  fs.unlinkSync(out);
});

test('v077: PDF escapes parentheses and backslashes', () => {
  const { buildPdf } = require('../src/pdf_writer');
  const s = buildPdf([{ text: 'a (b) \\ c' }]).toString('latin1');
  assert.ok(s.includes('a \\(b\\) \\\\ c'), 'text not escaped');
});

test('v077: word diff marks additions and deletions', () => {
  const { diffWords, similarity } = require('../src/text_diff');
  const d = diffWords('the quick brown fox', 'the quick red fox');
  assert.ok(d.some((x) => x.type === 'del' && x.text.trim() === 'brown'));
  assert.ok(d.some((x) => x.type === 'add' && x.text.trim() === 'red'));
  assert.equal(similarity('same text here', 'same text here'), 1);
  assert.ok(similarity('abc def', 'xyz uvw') < 0.5);
});

test('v077: comparison analysis returns pairwise similarity', () => {
  const { analyze } = require('../src/model_compare');
  const a = analyze({ results: [
    { model: 'a', ok: true, reply: 'hello world', duration: 10 },
    { model: 'b', ok: true, reply: 'hello there', duration: 20 },
    { model: 'c', ok: false, error: 'x', duration: 5 },
  ] });
  assert.equal(a.pairs.length, 1);
  assert.equal(a.pairs[0].a, 'a');
  assert.ok(a.pairs[0].similarity > 0 && a.pairs[0].similarity < 1);
  assert.equal(a.lengths.length, 2);
  assert.ok(typeof a.agreement === 'number');
});

test('v077: db exposes setSessionTags and sessions carry tags', () => {
  assert.match(read('src/storage/db.js'), /function setSessionTags/);
  assert.match(read('src/storage/db.js'), /structuredClone|tags: s\.tags \|\| \[\]|tags \}/);
  const db = require('../src/storage/db');
  if (!db.isOpen()) db.open(path.join(os.tmpdir(), 'aegisai-v077-' + Date.now() + '.db'));
  assert.equal(typeof db.setSessionTags, 'function');
  const id = 'v077_' + Date.now();
  db.saveSession({ id, title: 't', messages: [{ role: 'user', content: 'hi' }] });
  const r = db.setSessionTags(id, ['alpha', 'beta']);
  assert.equal(r.ok, true);
  const got = db.getSession(id);
  assert.deepEqual(got.tags, ['alpha', 'beta']);
  db.deleteSession(id);
});

test('v077: web UI has split editor, attachment chips, tag filter, diff view', () => {
  const app = read('public/app.js');
  assert.match(app, /editor-pane/);
  assert.match(app, /openInEditor/);
  assert.match(app, /attach-chips/);
  assert.match(app, /setAttachments/);
  assert.match(app, /tag-filter/);
  assert.match(app, /sessions\/tags/);
  assert.match(app, /function DiffText/);
  assert.match(app, /compare-grid/);
});

test('v077: API routes exist for diff, file save, session tags', () => {
  const src = read('src/index.js');
  assert.match(src, /'\/api\/diff'/);
  assert.match(src, /req\.method === 'POST' && req\.url\.split\('\?'\)\[0\] === '\/api\/file'/);
  assert.match(src, /'\/api\/sessions\/tags'/);
});
