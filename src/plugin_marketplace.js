// src/plugin_marketplace.js
// Plugin marketplace: discover, install, and manage plugins (OpenCode-style).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const https = require('https');

const REGISTRY_URL = 'https://raw.githubusercontent.com/user6811992/aegisai-harness/main/plugins/registry.json';
const PLUGINS_DIR = () => path.join(DATA_DIR, 'plugins');
const INSTALLED_FILE = () => path.join(PLUGINS_DIR(), 'installed.json');

function loadInstalled() {
  try { return JSON.parse(fs.readFileSync(INSTALLED_FILE(), 'utf8')); } catch (e) { return []; }
}
function saveInstalled(list) {
  fs.mkdirSync(PLUGINS_DIR(), { recursive: true });
  fs.writeFileSync(INSTALLED_FILE(), JSON.stringify(list, null, 2));
}
function list() { return loadInstalled(); }
function isInstalled(name) { return loadInstalled().some((p) => p.name === name); }

async function fetchRegistry() {
  try {
    const buf = await new Promise((resolve, reject) => {
      https.get(REGISTRY_URL, { headers: { 'User-Agent': 'AegisAI' } }, (r) => {
        if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
        let b = '';
        r.on('data', (c) => { b += c; });
        r.on('end', () => resolve(b));
      }).on('error', reject);
    });
    return JSON.parse(buf);
  } catch (e) { return { plugins: [], error: String(e.message || e) }; }
}

async function search(query) {
  const reg = await fetchRegistry();
  const q = String(query || '').toLowerCase();
  return (reg.plugins || []).filter((p) => !q || (p.name + ' ' + (p.description || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
}

async function install(name) {
  const reg = await fetchRegistry();
  const plugin = (reg.plugins || []).find((p) => p.name === name);
  if (!plugin) return { ok: false, error: 'plugin not found in registry' };
  if (isInstalled(name)) return { ok: false, error: 'already installed' };
  // Download plugin file
  const dir = path.join(PLUGINS_DIR(), name);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const buf = await new Promise((resolve, reject) => {
      https.get(plugin.url, { headers: { 'User-Agent': 'AegisAI' } }, (r) => {
        if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
        let b = '';
        r.on('data', (c) => { b += c; });
        r.on('end', () => resolve(b));
      }).on('error', reject);
    });
    fs.writeFileSync(path.join(dir, 'index.js'), buf);
    const installed = loadInstalled();
    installed.push({ name, version: plugin.version || '1.0.0', description: plugin.description || '', installedAt: new Date().toISOString() });
    saveInstalled(installed);
    return { ok: true, name, dir };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function uninstall(name) {
  const installed = loadInstalled().filter((p) => p.name !== name);
  saveInstalled(installed);
  const dir = path.join(PLUGINS_DIR(), name);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  return { ok: true, name };
}

module.exports = { fetchRegistry, search, install, uninstall, list, isInstalled, PLUGINS_DIR };
