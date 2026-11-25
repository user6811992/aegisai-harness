// src/skills_catalog.js
// Import skills from a remote catalog (openai/skills-style).
// The catalog is expected to be a JSON array or { skills: [...] } with
// { name, description, url?, license?, tags? }.
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/openai/skills/main/catalog.json';

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = /^https:/.test(url) ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'aegisai-skills-catalog' } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function normalizeCatalog(data) {
  const list = Array.isArray(data) ? data : (data && (data.skills || data.items || data.catalog)) || [];
  return list.map((s) => ({
    name: String(s.name || s.id || '').trim(),
    description: String(s.description || s.summary || '').trim(),
    url: s.url || s.source || s.link || null,
    license: s.license || null,
    tags: Array.isArray(s.tags) ? s.tags : [],
    version: s.version || null,
  })).filter((s) => s.name);
}

function catalogPath() { return path.join(DATA_DIR, 'skills-catalog.json'); }

function saveCatalog(items) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(catalogPath(), JSON.stringify({ fetched: new Date().toISOString(), skills: items }, null, 2)); return true; } catch (e) { return false; }
}

function loadCatalog() {
  try { const d = JSON.parse(fs.readFileSync(catalogPath(), 'utf8')); return { fetched: d.fetched, skills: d.skills || [] }; } catch (e) { return { fetched: null, skills: [] }; }
}

async function fetchCatalog(url) {
  const data = await fetchJson(url || DEFAULT_CATALOG_URL);
  const items = normalizeCatalog(data);
  saveCatalog(items);
  return { url: url || DEFAULT_CATALOG_URL, count: items.length, skills: items };
}

// Import a single skill from a URL into the default skills pack.
async function importSkill(url, name) {
  const text = await new Promise((resolve, reject) => {
    const lib = /^https:/.test(url) ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'aegisai-skills-catalog' } }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
  const dir = path.join(DATA_DIR, 'imported-skills', name || ('skill-' + Date.now()));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), text);
  return { ok: true, dir, bytes: text.length };
}

module.exports = { DEFAULT_CATALOG_URL, fetchJson, normalizeCatalog, fetchCatalog, loadCatalog, saveCatalog, importSkill, catalogPath };
