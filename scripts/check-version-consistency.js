// scripts/check-version-consistency.js
// package.json is the single source of truth. Every user-visible version string
// must agree with it, otherwise CI/release must fail instead of shipping a
// mislabeled installer (the v0.67.x releases had 0.56.0/0.67.4/0.67.7 assets).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch (e) { return ''; }
}

function check() {
  const version = JSON.parse(read('package.json')).version;
  const issues = [];
  const expect = (rel, re, label) => {
    const text = read(rel);
    if (!text) { issues.push(`${rel}: missing`); return; }
    const m = text.match(re);
    if (!m) { issues.push(`${rel}: ${label} pattern not found`); return; }
    if (m[1] !== version) issues.push(`${rel}: ${label} is ${m[1]}, expected ${version}`);
  };

  // Semver pattern including optional prerelease/build labels.
  const SV = '([0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)';
  expect('packaging/windows/installer.iss', new RegExp('AppVersion=' + SV), 'AppVersion');
  expect('packaging/windows/installer.iss', new RegExp('OutputBaseFilename=AegisAi-Harness-' + SV + '-Setup'), 'OutputBaseFilename');
  expect('README.md', new RegExp('Status: v' + SV), 'status version');
  expect('llms.txt', new RegExp('offline-first\\. v' + SV + '\\.'), 'catalog version');
  expect('CHANGELOG.md', new RegExp('^## \\[' + SV + '\\]', 'm'), 'latest changelog entry');
  expect('ROADMAP.md', new RegExp('Current version:\\*\\*\\s*v' + SV), 'current version');
  expect('packaging/tauri/tauri.conf.json', new RegExp('"version": "' + SV + '"'), 'tauri version');
  expect('packaging/tauri/Cargo.toml', new RegExp('version = "' + SV + '"'), 'tauri cargo version');

  const srcVersion = read('src/version.js');
  if (!srcVersion || !srcVersion.includes(`'${version}'`)) {
    issues.push(`src/version.js: does not export ${version}`);
  }

  return { ok: issues.length === 0, version, issues };
}

if (require.main === module) {
  const r = check();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

module.exports = { check };
