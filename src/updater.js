// src/updater.js
// Offline/online update checker.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const pkg = require('../package.json');

const MANIFEST_PATH = path.join(DATA_DIR, 'version.json');

function currentVersion() { return pkg.version; }

function checkLocal() {
  if (!fs.existsSync(MANIFEST_PATH)) return { current: currentVersion(), latest: currentVersion(), updateAvailable: false };
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return { current: currentVersion(), latest: m.version || currentVersion(), updateAvailable: (m.version && m.version !== currentVersion()) };
  } catch (e) {
    return { current: currentVersion(), latest: currentVersion(), updateAvailable: false };
  }
}

function writeManifest(version) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ version, checked: new Date().toISOString() }, null, 2));
}

async function checkRemote(url) {
  // url: a URL returning { version: "x.y.z" }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return checkLocal();
    const data = await r.json();
    const latest = data.version || currentVersion();
    const updateAvailable = latest !== currentVersion();
    writeManifest(latest);
    return { current: currentVersion(), latest, updateAvailable };
  } catch (e) {
    return checkLocal();
  }
}

async function downloadUpdate(url, outPath) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('download failed: ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return { path: outPath, bytes: buf.length };
}

module.exports = { currentVersion, checkLocal, checkRemote, writeManifest, downloadUpdate, MANIFEST_PATH };
