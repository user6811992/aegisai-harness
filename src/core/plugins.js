// src/core/plugins.js
// Plugin loader with optional signature verification.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

const PLUGINS_DIR = path.join(DATA_DIR, 'plugins');
const loaded = [];

function loadPlugins(app) {
  try { fs.mkdirSync(PLUGINS_DIR, { recursive: true }); } catch (e) {}
  let entries;
  try { entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true }); } catch (e) { return loaded; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(PLUGINS_DIR, e.name);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const entry = path.join(dir, manifest.entry || 'index.js');
      if (!fs.existsSync(entry)) continue;
      if (manifest.signature) {
        const crypto = require('crypto');
        const buf = fs.readFileSync(entry);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (hash !== manifest.signature) {
          console.error('Plugin signature mismatch, skipping:', manifest.name || e.name);
          continue;
        }
      }
      const mod = require(entry);
      if (typeof mod.init === 'function') mod.init(app);
      loaded.push({ name: manifest.name || e.name, version: manifest.version || '0.0.0', description: manifest.description || '', dir, permissions: manifest.permissions || [], tools: typeof mod.tools === 'function' ? mod.tools() : [] });
      console.log('Plugin loaded:', manifest.name || e.name, 'permissions:', (manifest.permissions || []).join(',') || 'none');
    } catch (err) {
      console.error('Plugin load failed (' + e.name + '):', err.message);
    }
  }
  return loaded;
}

function listPlugins() { return loaded.map((p) => ({ name: p.name, version: p.version, description: p.description, permissions: p.permissions, toolCount: p.tools.length })); }
function getPluginTools() { const out = {}; for (const p of loaded) out['plugin_' + p.name] = p.tools; return out; }

module.exports = { loadPlugins, listPlugins, getPluginTools, PLUGINS_DIR };
