// src/ioc_import.js
// Import indicator-of-compromise feeds (hashes, domains, IPs, URLs) into the
// security knowledge base for offline matching.
const fs = require('fs');
const path = require('path');

const PATTERNS = {
  md5: /\b[a-f0-9]{32}\b/gi,
  sha1: /\b[a-f0-9]{40}\b/gi,
  sha256: /\b[a-f0-9]{64}\b/gi,
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
  domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|dev|co|info|biz|xyz|ru|cn|top|site|online|shop)\b/gi,
  url: /https?:\/\/[^\s"'<>]+/g,
  cve: /\bCVE-\d{4}-\d{4,7}\b/gi,
};

function extract(text, opts) {
  opts = opts || {};
  const out = { md5: [], sha1: [], sha256: [], ipv4: [], domain: [], url: [], cve: [] };
  const seen = new Set();
  for (const [kind, re] of Object.entries(PATTERNS)) {
    if (opts.kinds && !opts.kinds.includes(kind)) continue;
    const rx = new RegExp(re.source, re.flags);
    let m;
    let guard = 0;
    while ((m = rx.exec(text)) !== null && guard++ < 5000) {
      const v = m[0].toLowerCase();
      const key = kind + ':' + v;
      if (seen.has(key)) continue;
      // Filter obvious noise.
      if (kind === 'domain' && /^(www\.)?example\.(com|org|net)$/.test(v)) continue;
      if (kind === 'ipv4' && (v === '0.0.0.0' || v.startsWith('127.') || v === '255.255.255.255')) continue;
      seen.add(key);
      out[kind].push(v);
    }
  }
  return out;
}

// Parse common feed formats: plain lines, CSV (one indicator per row), JSON arrays.
function parseFeed(content, name) {
  const text = String(content || '');
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : (data.indicators || data.iocs || []);
      const flat = list.map((x) => (typeof x === 'string' ? x : (x.value || x.indicator || x.ioc || ''))).filter(Boolean).join('\n');
      return Object.assign({ source: name || 'json' }, extract(flat));
    } catch (e) { /* fall through to text */ }
  }
  return Object.assign({ source: name || 'text' }, extract(text));
}

function summarize(parsed) {
  const total = ['md5', 'sha1', 'sha256', 'ipv4', 'domain', 'url', 'cve'].reduce((a, k) => a + (parsed[k] || []).length, 0);
  return { total, byKind: Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, (parsed[k] || []).length])) };
}

// Persist into the security knowledge base.
function importToKb(parsed, opts) {
  opts = opts || {};
  const kb = require('./security_kb');
  const added = [];
  const source = parsed.source || 'ioc-feed';
  for (const kind of ['sha256', 'sha1', 'md5', 'ipv4', 'domain', 'url', 'cve']) {
    for (const value of parsed[kind] || []) {
      const entry = { id: 'ioc-' + kind + '-' + value, kind, value, source, tags: ['ioc', kind] };
      try {
        if (typeof kb.addIndicator === 'function') kb.addIndicator(entry);
        added.push(entry.id);
      } catch (e) { /* ignore individual failures */ }
    }
  }
  return { added: added.length, source, ids: added.slice(0, 200) };
}

function importFile(filePath, opts) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFeed(content, path.basename(filePath));
  if (opts && opts.persist) return { parsed, summary: summarize(parsed), kb: importToKb(parsed, opts) };
  return { parsed, summary: summarize(parsed) };
}

// Offline match: does this text contain any indicator from the feed?
function match(text, feed) {
  const hay = String(text || '').toLowerCase();
  const hits = [];
  for (const kind of ['sha256', 'sha1', 'md5', 'ipv4', 'domain', 'url', 'cve']) {
    for (const v of feed[kind] || []) if (hay.includes(v)) hits.push({ kind, value: v });
  }
  return hits;
}

module.exports = { PATTERNS, extract, parseFeed, summarize, importToKb, importFile, match };
