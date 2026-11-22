// src/plugin_marketplace.js
// Plugin marketplace: discover, install, manage plugins (OpenCode-style) with categories, ratings, deps, versions.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const https = require('https');
const crypto = require('crypto');

const REGISTRY_URL = 'https://raw.githubusercontent.com/user6811992/aegisai-harness/main/plugins/registry.json';
const PLUGINS_DIR = () => path.join(DATA_DIR, 'plugins');
const INSTALLED_FILE = () => path.join(PLUGINS_DIR(), 'installed.json');

// Curated featured plugins (built-in catalog, always available offline)
const FEATURED = [
  { name: 'code-review', version: '1.0.0', description: 'Review code for correctness and security', category: 'development', tags: ['review', 'quality'], author: 'aegisai', license: 'MIT', rating: 4.8, downloads: 1200 },
  { name: 'doc-discipline', version: '1.0.0', description: 'Keep documentation in sync with code', category: 'documentation', tags: ['docs', 'sync'], author: 'aegisai', license: 'MIT', rating: 4.5, downloads: 800 },
  { name: 'context-compress', version: '1.0.0', description: 'Compress long context keeping errors and decisions', category: 'context', tags: ['compression', 'context'], author: 'aegisai', license: 'MIT', rating: 4.7, downloads: 950 },
  { name: 'search-before-re', version: '1.0.0', description: 'Search for existing RE work before starting', category: 'reverse-engineering', tags: ['re', 'search'], author: 'aegisai', license: 'MIT', rating: 4.6, downloads: 600 },
  { name: 'android-re', version: '1.0.0', description: 'Guide Android APK reverse engineering', category: 'reverse-engineering', tags: ['android', 're'], author: 'aegisai', license: 'MIT', rating: 4.4, downloads: 450 },
  { name: 'ui-review', version: '1.0.0', description: 'Review UI implementation against reference', category: 'design', tags: ['ui', 'review'], author: 'aegisai', license: 'MIT', rating: 4.3, downloads: 380 },
  { name: 'design-review', version: '1.0.0', description: 'Review designs for usability and accessibility', category: 'design', tags: ['design', 'a11y'], author: 'aegisai', license: 'MIT', rating: 4.2, downloads: 320 },
  { name: 'pr-review', version: '1.0.0', description: 'Review pull requests for correctness and security', category: 'development', tags: ['pr', 'review'], author: 'aegisai', license: 'MIT', rating: 4.9, downloads: 1500 },
];

function loadInstalled() { try { return JSON.parse(fs.readFileSync(INSTALLED_FILE(), 'utf8')); } catch (e) { return []; } }
function saveInstalled(list) { fs.mkdirSync(PLUGINS_DIR(), { recursive: true }); fs.writeFileSync(INSTALLED_FILE(), JSON.stringify(list, null, 2)); }
function list() { return loadInstalled(); }
function isInstalled(name) { return loadInstalled().some((p) => p.name === name); }
function getInstalled(name) { return loadInstalled().find((p) => p.name === name) || null; }

function categories() { return [...new Set(FEATURED.map((p) => p.category))].sort(); }

async function fetchRegistry() {
  try {
    const buf = await new Promise((resolve, reject) => {
      https.get(REGISTRY_URL, { headers: { 'User-Agent': 'AegisAI' } }, (r) => {
        if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
        let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => resolve(b));
      }).on('error', reject);
    });
    const parsed = JSON.parse(buf);
    return Array.isArray(parsed.plugins) ? parsed.plugins : (Array.isArray(parsed) ? parsed : []);
  } catch (e) { return []; }
}

async function search(query, opts) {
  opts = opts || {};
  const reg = await fetchRegistry();
  const all = (reg.length ? reg : FEATURED).concat(reg.length ? [] : []);
  const combined = reg.length ? reg : FEATURED;
  const q = String(query || '').toLowerCase();
  let results = combined;
  if (q) results = results.filter((p) => (p.name + ' ' + (p.description || '') + ' ' + (p.tags || []).join(' ') + ' ' + (p.category || '') + ' ' + (p.author || '')).toLowerCase().includes(q));
  if (opts.category) results = results.filter((p) => p.category === opts.category);
  if (opts.tag) results = results.filter((p) => (p.tags || []).includes(opts.tag));
  if (opts.minRating) results = results.filter((p) => (p.rating || 0) >= opts.minRating);
  // sort by rating desc, then downloads desc
  results.sort((a, b) => ((b.rating || 0) - (a.rating || 0)) || ((b.downloads || 0) - (a.downloads || 0)));
  // mark installed
  return results.map((p) => ({ ...p, installed: isInstalled(p.name), installedVersion: getInstalled(p.name)?.version }));
}

async function install(name, opts) {
  opts = opts || {};
  const reg = await fetchRegistry();
  const source = (reg.length ? reg : FEATURED).find((p) => p.name === name);
  if (!source && !opts.url && !opts.content) return { ok: false, error: 'plugin not found in registry' };
  if (isInstalled(name) && !opts.force) return { ok: false, error: 'already installed (use force to reinstall)' };

  const dir = path.join(PLUGINS_DIR(), name);
  fs.mkdirSync(dir, { recursive: true });

  // Download or write
  let content = opts.content || null;
  const url = opts.url || (source && source.url);
  if (url && !content) {
    try {
      content = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'AegisAI' } }, (r) => {
          if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
          let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => resolve(b));
        }).on('error', reject);
      });
    } catch (e) { return { ok: false, error: 'download failed: ' + e.message }; }
  }
  if (content) fs.writeFileSync(path.join(dir, 'index.js'), content);
  else fs.writeFileSync(path.join(dir, 'index.js'), '// plugin: ' + name + '\nmodule.exports = {};\n');

  // Write metadata
  const meta = {
    name,
    version: (source && source.version) || opts.version || '1.0.0',
    description: (source && source.description) || opts.description || '',
    category: (source && source.category) || opts.category || 'general',
    tags: (source && source.tags) || opts.tags || [],
    author: (source && source.author) || opts.author || 'unknown',
    license: (source && source.license) || opts.license || 'MIT',
    installedAt: new Date().toISOString(),
    enabled: true,
    dependencies: (source && source.dependencies) || opts.dependencies || [],
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

  // Check dependencies
  const missingDeps = meta.dependencies.filter((d) => !isInstalled(d));
  if (missingDeps.length) {
    // auto-install deps
    for (const dep of missingDeps) {
      const r = await install(dep);
      if (!r.ok) console.error('failed to install dep:', dep, r.error);
    }
  }

  const installed = loadInstalled().filter((p) => p.name !== name);
  installed.push(meta);
  saveInstalled(installed);
  return { ok: true, name, dir, version: meta.version, missingDeps };
}

function uninstall(name) {
  const installed = loadInstalled().filter((p) => p.name !== name);
  saveInstalled(installed);
  const dir = path.join(PLUGINS_DIR(), name);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  return { ok: true, name };
}

function enable(name) {
  const installed = loadInstalled();
  const p = installed.find((x) => x.name === name);
  if (!p) return { ok: false, error: 'not installed' };
  p.enabled = true;
  saveInstalled(installed);
  return { ok: true, name, enabled: true };
}

function disable(name) {
  const installed = loadInstalled();
  const p = installed.find((x) => x.name === name);
  if (!p) return { ok: false, error: 'not installed' };
  p.enabled = false;
  saveInstalled(installed);
  return { ok: true, name, enabled: false };
}

function update(name) {
  const installed = getInstalled(name);
  if (!installed) return { ok: false, error: 'not installed' };
  return install(name, { force: true });
}

function info(name) {
  const installed = getInstalled(name);
  if (installed) return { ...installed, installed: true };
  const featured = FEATURED.find((p) => p.name === name);
  if (featured) return { ...featured, installed: false };
  return null;
}

function stats() {
  const installed = loadInstalled();
  return {
    installed: installed.length,
    enabled: installed.filter((p) => p.enabled !== false).length,
    categories: categories(),
    featured: FEATURED.length,
  };
}

module.exports = { fetchRegistry, search, install, uninstall, list, isInstalled, getInstalled, enable, disable, update, info, stats, categories, FEATURED, PLUGINS_DIR };
