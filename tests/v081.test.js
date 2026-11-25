const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

test('v081: http probe fingerprints tech and extracts titles', () => {
  const { fingerprint, extractTitle } = require('../src/http_probe');
  const tech = fingerprint({ server: 'nginx/1.25', 'x-powered-by': 'Express' }, '<html><title>Hi</title><script src="/react.js"></script></html>', '');
  assert.ok(tech.includes('nginx'), 'nginx not detected: ' + tech);
  assert.ok(tech.includes('express'), 'express not detected: ' + tech);
  assert.ok(tech.includes('react'), 'react not detected: ' + tech);
  assert.equal(extractTitle('<html><TITLE> Hello   World </TITLE></html>'), 'Hello World');
  assert.equal(extractTitle('no title'), '');
});

test('v081: http probe handles unreachable targets without throwing', async () => {
  const { probeOne } = require('../src/http_probe');
  const r = await probeOne('http://127.0.0.1:1/', { timeoutMs: 1500 });
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test('v081: pentest eval scores fixtures and produces precision/recall', async () => {
  const { run } = require('../src/pentest_eval');
  const r = await run({ ids: ['clean-repo'] });
  assert.equal(r.fixtures.length, 1);
  assert.equal(r.summary.fixtures, 1);
  assert.ok(['pass', 'warn', 'fail'].includes(r.summary.verdict));
  assert.ok(typeof r.summary.precision === 'number');
  assert.ok(typeof r.summary.recall === 'number');
});

test('v081: pentest eval score() computes precision and recall correctly', () => {
  const { score } = require('../src/pentest_eval');
  const s = score([{ family: 'secret', file: 'a' }, { family: 'secret', file: 'b' }], [{ family: 'secret', file: 'a' }, { family: 'code', file: 'c' }]);
  assert.equal(s.truePositives, 1);
  assert.equal(s.falsePositives, 1);
  assert.equal(s.falseNegatives, 1);
  assert.equal(s.precision, 0.5);
  assert.equal(s.recall, 0.5);
});

test('v081: tiny router normalizes answers and falls back to heuristics', async () => {
  const { normalize, heuristic, decide } = require('../src/tiny_router');
  assert.equal(normalize('YES'), true);
  assert.equal(normalize('No, do not.'), false);
  assert.equal(normalize('maybe'), null);
  assert.equal(heuristic('delete the production database').answer, false);
  assert.equal(heuristic('read the config file').answer, true);
  const r = await decide('should I delete the database?', { allowModel: false });
  assert.equal(r.source, 'heuristic');
  assert.equal(r.answer, false);
});

test('v081: tiny router caches decisions', async () => {
  const { decide, clearCache, cacheSize } = require('../src/tiny_router');
  clearCache();
  await decide('cache me', { allowModel: false });
  assert.equal(cacheSize(), 1);
  const second = await decide('cache me', { allowModel: false });
  assert.equal(second.cached, true);
});

test('v081: deck generates a 16:9 multi-slide PDF', () => {
  const deck = require('../src/deck');
  const slides = deck.fromOutline('# Title\n- one\n- two\n## Second\n- three\n> note here\n');
  assert.equal(slides.length, 2);
  assert.equal(slides[0].bullets.length, 2);
  const out = path.join(os.tmpdir(), 'deck-' + Date.now() + '.pdf');
  const r = deck.generate(slides, out);
  assert.equal(r.slides, 2);
  const buf = fs.readFileSync(out);
  assert.equal(buf.slice(0, 8).toString('latin1'), '%PDF-1.4');
  const text = buf.toString('latin1');
  assert.match(text, /\/MediaBox \[0 0 960 540\]/);
  fs.unlinkSync(out);
});

test('v081: skill schema validates canonical SKILL.md frontmatter', () => {
  const { validateText } = require('../src/skill_schema');
  const good = '---\nname: pdf-processing\ndescription: Extract text and tables from PDF documents reliably.\nlicense: MIT\nallowed-tools: Read Write Bash\n---\n\n# PDF processing\n\nBody.\n';
  const r = validateText(good);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.name, 'pdf-processing');

  const missing = validateText('# no frontmatter\n');
  assert.equal(missing.ok, false);

  const badName = validateText('---\nname: Bad_Name\ndescription: A sufficiently long description here.\n---\nbody\n');
  assert.equal(badName.ok, false);
  assert.ok(badName.errors.some((e) => e.field === 'name'));
});

test('v081: guardrail api denies destructive tools in read-only mode', () => {
  const g = require('../src/guardrail_api');
  const denied = g.evaluate({ tool: 'write_file', args: { path: 'a.txt' }, context: { readOnly: true, projectRoot: false } });
  assert.equal(denied.decision, 'deny');
  const allowed = g.evaluate({ tool: 'read_file', args: { path: 'a.txt' }, context: { readOnly: true, projectRoot: false } });
  assert.equal(allowed.decision, 'allow');
  assert.equal(g.isAllowed({ tool: 'read_file', args: {}, context: { projectRoot: false } }), true);
});

test('v081: guardrail api surfaces policy denials', () => {
  const g = require('../src/guardrail_api');
  const policy = { rules: [{ name: 'no-net', condition: { field: 'tool_name', op: 'equals', value: 'fetch_url' }, action: 'deny' }], defaults: { action: 'allow' } };
  const r = g.evaluate({ tool: 'fetch_url', args: { url: 'https://x' }, context: { policy, projectRoot: false } });
  assert.equal(r.decision, 'deny');
});

test('v081: ioc import extracts and matches indicators', () => {
  const ioc = require('../src/ioc_import');
  const feed = [
    'evil.example.com',
    'http://evil.example.com/payload.bin',
    '203.0.113.77',
    'sha256: ' + 'a'.repeat(64),
    'CVE-2026-12345',
  ].join('\n');
  const parsed = ioc.parseFeed(feed, 'test');
  assert.ok(parsed.domain.includes('evil.example.com'));
  assert.ok(parsed.ipv4.includes('203.0.113.77'));
  assert.ok(parsed.sha256.includes('a'.repeat(64)));
  assert.ok(parsed.cve.includes('cve-2026-12345'));
  const hits = ioc.match('we saw traffic to 203.0.113.77 today', parsed);
  assert.ok(hits.some((h) => h.value === '203.0.113.77'));
});

test('v081: security logs are deterministic for a seed', () => {
  const logs = require('../src/security_logs');
  const a = logs.generate({ seed: 7, perScenario: 5 });
  const b = logs.generate({ seed: 7, perScenario: 5 });
  assert.deepEqual(a.events, b.events);
  assert.equal(a.events.length, logs.SCENARIOS.length * 5);
  const exp = logs.expectations(a);
  assert.ok(exp.bruteForce > 0);
  assert.ok(exp.webScan > 0);
  assert.match(logs.toJsonl(a), /^\{"ts"/);
  assert.match(logs.toCsv(a), /^ts,/);
});

test('v081: channels-extra builds Teams and Mattermost payloads', () => {
  const ch = require('../src/channels_extra');
  const teams = ch.teamsPayload('hello');
  assert.equal(teams['@type'], 'MessageCard');
  const mm = ch.mattermostPayload('hi', { channel: 'town-square' });
  assert.equal(mm.channel, 'town-square');
  const mock = ch.handleTeams('@aegisai hello there');
  assert.equal(mock.channel, 'teams');
  assert.equal(mock.ok, false);
  assert.equal(mock.note.includes('mock'), true);
  const st = ch.status();
  assert.ok(st.existing.includes('slack'));
});

test('v081: agent CLI adapters detect availability without running', () => {
  const a = require('../src/agent_cli');
  const detected = a.detect();
  assert.equal(detected.length, a.ADAPTERS.length);
  for (const d of detected) assert.equal(typeof d.available, 'boolean');
  const dry = a.run('codex', 'do a thing', { dryRun: true });
  assert.ok(dry.dryRun === true || dry.error, 'unexpected: ' + JSON.stringify(dry));
});

test('v081: package guard catches typosquats and unpinned installs', () => {
  const pg = require('../src/package_guard');
  const typo = pg.checkCommand('npm install experss');
  assert.equal(typo.decision, 'deny');
  assert.ok(typo.reasons.some((r) => /typosquat/i.test(r)));

  const pinned = pg.checkCommand('npm install lodash@4.17.21');
  assert.equal(pinned.decision, 'allow', JSON.stringify(pinned.reasons));

  const unpinned = pg.checkCommand('npm install lodash');
  assert.ok(unpinned.packages[0].reasons.some((r) => /unpinned/i.test(r)));

  const denied = pg.checkCommand('npm install event-stream');
  assert.equal(denied.decision, 'deny');

  assert.equal(pg.checkCommand('ls -la').decision, 'not-an-install');
});

test('v081: LSP workspace-edit application edits text correctly', () => {
  const lsp = require('../src/lsp');
  const file = path.join(os.tmpdir(), 'aegisai-rename-' + Date.now() + '.js');
  fs.writeFileSync(file, 'const a = 1;\nconsole.log(a);\n', 'utf8');
  const uri = 'file://' + file.replace(/\\/g, '/');
  const edit = { changes: { [uri]: [
    { range: { start: { line: 1, character: 12 }, end: { line: 1, character: 13 } }, newText: 'renamed' },
    { range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } }, newText: 'renamed' },
  ] } };
  const dry = lsp.applyWorkspaceEdit(edit, { dryRun: true });
  assert.equal(dry.ok, true);
  assert.equal(dry.files[0].edits, 2);
  assert.equal(fs.readFileSync(file, 'utf8'), 'const a = 1;\nconsole.log(a);\n', 'dry run must not write');
  const applied = lsp.applyWorkspaceEdit(edit, {});
  assert.equal(applied.ok, true);
  const out = fs.readFileSync(file, 'utf8');
  assert.match(out, /const renamed = 1;/);
  assert.match(out, /console\.log\(renamed\);/);
  fs.unlinkSync(file);
});

test('v081: security KB persists indicators', () => {
  const kb = require('../src/security_kb');
  const v = 'ioc-test-' + Date.now() + '.example.com';
  const r = kb.addIndicator({ kind: 'domain', value: v, source: 'test' });
  assert.equal(r.ok, true);
  const hits = kb.matchIndicators('traffic to ' + v);
  assert.ok(hits.some((h) => h.value === v));
});

test('v081: architecture map page and code-map API exist', () => {
  const app = read('public/map.html');
  assert.match(app, /\/api\/code-map/);
  assert.match(app, /\/authtoken\.js/);
  const src = read('src/index.js');
  assert.match(src, /'\/api\/code-map'/);
  assert.match(src, /'\/api\/probe'/);
  assert.match(src, /'\/api\/pentest-eval'/);
  assert.match(src, /'\/api\/guardrail'/);
  assert.match(src, /'\/api\/ioc'/);
  assert.match(src, /'\/api\/security-logs'/);
  assert.match(src, /'\/api\/package-guard'/);
  assert.match(src, /'\/api\/agent-cli'/);
  assert.match(src, /'\/api\/deck'/);
  assert.match(src, /'\/api\/decide'/);
  assert.match(src, /'\/api\/skill-schema'/);
});
