const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const { resolvePublicPath, tokenMatches } = require('../src/http_utils');

test('v068: package.json is the single version source', () => {
  const r = require('../scripts/check-version-consistency').check();
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
  assert.equal(require('../src/version').VERSION, require('../package.json').version);
});

test('v068: every ROADMAP "Current version" declaration matches package.json', () => {
  const fs = require('fs');
  const path = require('path');
  const version = require('../package.json').version;
  const text = fs.readFileSync(path.join(__dirname, '..', 'ROADMAP.md'), 'utf8');
  const matches = [...text.matchAll(/Current version:\*\*\s*v([0-9]+\.[0-9]+\.[0-9]+)/g)];
  assert.ok(matches.length >= 2, 'ROADMAP should have top and footer version declarations');
  matches.forEach((m, i) => {
    assert.equal(m[1], version, `ROADMAP current version #${i + 1} is stale`);
  });
});

test('v068: CLI entry point has a shebang and supports --version/--help', () => {
  assert.equal(read('src/index.js').split(/\r?\n/)[0].trim(), '#!/usr/bin/env node');
  const entry = path.join(ROOT, 'src', 'index.js');
  const version = execFileSync(process.execPath, [entry, '--version'], { encoding: 'utf8' }).trim();
  assert.equal(version, require('../package.json').version);
  const help = execFileSync(process.execPath, [entry, '--help'], { encoding: 'utf8' });
  assert.match(help, /--web/);
  assert.match(help, /--mcp-server/);
});

test('v068: web chat sends the field the server reads', () => {
  const app = read('public/app.js');
  assert.match(app, /JSON\.stringify\(\{\s*message:\s*text/);
  assert.doesNotMatch(app, /JSON\.stringify\(\{\s*prompt:\s*text\s*\}\) /);
});

test('v068: onboarding applies model and token, config accepts them', () => {
  const app = read('public/app.js');
  assert.match(app, /body\.AEGISAI_MODEL = model/);
  assert.match(app, /body\.AEGISAI_TOKEN = token/);
  const index = read('src/index.js');
  assert.match(index, /'AEGISAI_TOKEN', 'AEGISAI_WEB_AUTO_APPROVE'/);
});

test('v068: TUI path no longer uses root before declaration', () => {
  const before = read('src/index.js');
  const tuiBlock = before.slice(before.indexOf('if (tuiFlag)'), before.indexOf('if (mcpServerFlag)'));
  assert.doesNotMatch(tuiBlock, /projectRoot:\s*root\b/);
  assert.match(tuiBlock, /projectRoot:\s*process\.cwd\(\)/);
});

test('v068: browser tool execution is opt-in', () => {
  const index = read('src/index.js');
  assert.match(index, /AEGISAI_WEB_AUTO_APPROVE === 'true'/);
});

test('v068: resolvePublicPath blocks traversal and decodes safely', () => {
  const root = path.join(ROOT, 'public');
  assert.equal(resolvePublicPath(root, '/'), path.join(root, 'index.html'));
  assert.equal(resolvePublicPath(root, '/style.css'), path.join(root, 'style.css'));
  assert.equal(resolvePublicPath(root, '/../package.json'), null);
  assert.equal(resolvePublicPath(root, '/%2e%2e/package.json'), null);
  assert.equal(resolvePublicPath(root, '/..\\package.json'), null);
  assert.equal(resolvePublicPath(root, '/%ZZ'), null);
  assert.equal(resolvePublicPath(root, '/vendor/preact.mjs'), path.join(root, 'vendor', 'preact.mjs'));
});

test('v068: token comparison is constant-time and dynamic', () => {
  assert.equal(tokenMatches('anything', ''), true);
  assert.equal(tokenMatches('secret', 'secret'), true);
  assert.equal(tokenMatches('wrong', 'secret'), false);
  assert.equal(tokenMatches('secret', 'secreT'), false);
});

test('v068: UI dependencies are vendored, not loaded from a CDN', () => {
  for (const f of ['preact.mjs', 'hooks.mjs', 'htm.mjs', 'tailwind.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'public', 'vendor', f)), `${f} missing`);
  }
  assert.doesNotMatch(read('public/index.html'), /cdn\.tailwindcss\.com/);
  assert.doesNotMatch(read('public/app.js'), /https:\/\/esm\.sh/);
  assert.match(read('public/sw.js'), /vendor\/preact\.mjs/);
});

test('v068: installer preflights Node and cleans stale dependencies', () => {
  const iss = read('packaging/windows/installer.iss');
  assert.match(iss, /where node/);
  assert.match(iss, /22\.13/);
  assert.match(iss, /\[UninstallDelete\]/);
  assert.match(iss, /\{app\}\\node_modules/);
  const cmd = read('packaging/windows/aegisai-harness.cmd');
  assert.match(cmd, /--omit=dev/);
  assert.doesNotMatch(cmd, /2>nul/);
});

test('v068: build scripts use pkg 6 with Node 24 targets and --out-path', () => {
  assert.match(read('packaging/build-binary.sh'), /@yao-pkg\/pkg@6/);
  assert.match(read('packaging/build-binary.sh'), /--out-path/);
  assert.doesNotMatch(read('packaging/build-binary.sh'), /node22-/);
  assert.match(read('packaging/build.ps1'), /node24-win-x64/);
  assert.match(read('packaging/build.ps1'), /Get-FileHash/);
});
