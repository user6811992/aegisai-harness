// src/dataset.js
// Clean-room dataset curation tools for JSON/JSONL LLM training data.
// Inspired by eelbaz/LostRuins datasetexplorer (AGPL-3.0) — this is an
// independent implementation of the ideas, not a copy of its code.
// Local-only: reads/writes local files, no network.
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ---- Format-aware rendering ----

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Extract text from a dataset item. Handles plain strings, Alpaca-style
// {instruction, input, output}, ShareGPT-style {conversations:[{from,value}]},
// and generic nested objects/arrays.
function render(item, format) {
  format = format || detectFormat(item);
  let text = '';
  let turns = 0;
  if (typeof item === 'string') {
    text = item;
    turns = 1;
  } else if (Array.isArray(item)) {
    const parts = [];
    for (const el of item) {
      const r = render(el, 'auto');
      parts.push(r.text);
      turns += r.turns;
    }
    text = parts.join('\n');
  } else if (isPlainObject(item)) {
    if (format === 'alpaca') {
      const parts = [item.instruction, item.input, item.output]
        .filter((v) => v != null && v !== '')
        .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
      text = parts.join('\n');
      turns = parts.length;
    } else if (format === 'sharegpt' && Array.isArray(item.conversations)) {
      text = item.conversations.map((m) => {
        turns += 1;
        return m && (m.value || m.text || m.content) || '';
      }).join('\n');
    } else {
      const parts = [];
      for (const [k, v] of Object.entries(item)) {
        const r = render(v, 'auto');
        parts.push(r.text);
        turns += r.turns;
      }
      text = parts.join('\n');
    }
  }
  const words = (text.match(/[a-zA-Z0-9_]+/g) || []).length;
  return { text, turns, chars: text.length, words };
}

function detectFormat(item) {
  if (typeof item === 'string') return 'text';
  if (isPlainObject(item)) {
    if (Array.isArray(item.conversations)) return 'sharegpt';
    if ('instruction' in item || 'output' in item) return 'alpaca';
  }
  return 'generic';
}

// ---- Loading (streaming JSONL, chunked JSON array) ----

function parseJsonlStream(filePath, opts) {
  opts = opts || {};
  const start = opts.start != null ? opts.start : 0;
  const end = opts.end != null ? opts.end : Infinity;
  const maxItems = opts.maxItems != null ? opts.maxItems : Infinity;
  const items = [];
  let idx = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  return new Promise((resolve, reject) => {
    rl.on('line', (line) => {
      if (!line.trim()) return;
      if (idx >= start && idx <= end && items.length < maxItems) {
        try { items.push(JSON.parse(line)); }
        catch (e) { if (opts.onError) opts.onError({ line: idx, error: String(e.message || e) }); }
      }
      idx += 1;
    });
    rl.on('close', () => resolve({ items, totalLines: idx }));
    rl.on('error', reject);
  });
}

function parseJsonArrayChunked(filePath, opts) {
  opts = opts || {};
  const CHUNK = 32 * 1024 * 1024; // 32 MB chunks
  const content = fs.readFileSync(filePath, 'utf8');
  const items = [];
  // Parse whole file for correctness; chunk size used only for progress reporting.
  try {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const start = opts.start || 0;
    // Inclusive end (matches JSONL stream range semantics); default to last index.
    const end = opts.end != null ? opts.end : arr.length - 1;
    const maxItems = opts.maxItems || Infinity;
    for (let i = start; i <= Math.min(end, arr.length - 1) && items.length < maxItems; i += 1) {
      items.push(arr[i]);
    }
    return { items, totalItems: arr.length, bytes: Buffer.byteLength(content) };
  } catch (e) {
    throw new Error('invalid JSON: ' + String(e.message || e));
  }
}

async function load(filePath, opts) {
  opts = opts || {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('dataset file not found: ' + resolved);
  const ext = path.extname(resolved).toLowerCase();
  if (ext === '.jsonl' || ext === '.ndjson') return parseJsonlStream(resolved, opts);
  if (opts.streamingJson) return parseJsonArrayChunked(resolved, opts);
  return parseJsonArrayChunked(resolved, opts);
}

// ---- Filtering ----

function compilePattern(search, opts) {
  if (search == null || search === '') return null;
  if (opts.regex) return new RegExp(search, opts.caseSensitive ? 'g' : 'gi');
  const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, opts.caseSensitive ? 'g' : 'gi');
}

function filter(items, criteria) {
  criteria = criteria || {};
  let pattern = null;
  try { pattern = compilePattern(criteria.search, criteria); }
  catch (e) { throw new Error('invalid search pattern: ' + String(e.message || e)); }
  const out = [];
  items.forEach((item, index) => {
    const r = render(item, criteria.format);
    if (criteria.minChars != null && r.chars < criteria.minChars) return;
    if (criteria.maxChars != null && r.chars > criteria.maxChars) return;
    if (criteria.minWords != null && r.words < criteria.minWords) return;
    if (criteria.maxWords != null && r.words > criteria.maxWords) return;
    if (criteria.minTurns != null && r.turns < criteria.minTurns) return;
    if (criteria.maxTurns != null && r.turns > criteria.maxTurns) return;
    let matches = 0;
    if (pattern) matches = (r.text.match(pattern) || []).length;
    if (criteria.minMatches != null && matches < criteria.minMatches) return;
    if (criteria.maxMatches != null && matches > criteria.maxMatches) return;
    out.push({ index, item, metrics: r, matches });
  });
  const sort = criteria.sort;
  if (sort) {
    const key = sort.key || 'chars';
    const dir = sort.direction === 'asc' ? 1 : -1;
    out.sort((a, b) => {
      const av = key === 'matches' ? a.matches : (a.metrics[key] != null ? a.metrics[key] : 0);
      const bv = key === 'matches' ? b.matches : (b.metrics[key] != null ? b.metrics[key] : 0);
      return (av - bv) * dir;
    });
  }
  return out;
}

// ---- N-grams ----

function ngram(items, n, opts) {
  n = Math.max(1, n || 1);
  opts = opts || {};
  const counts = new Map();
  for (const item of items) {
    const text = render(item, opts.format).text;
    const words = text.split(/\s+/).filter(Boolean);
    for (let i = 0; i <= words.length - n; i += 1) {
      const gram = words.slice(i, i + n).join(' ');
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([ng, cnt]) => ({ ng, cnt }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, opts.limit || Infinity);
}

// ---- Dedup / merge / selection ----

function sanitize(obj) {
  if (typeof obj === 'string') {
    return obj.toLowerCase().replace(/[!?(){}\[\]:;,.]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (isPlainObject(obj)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    return out;
  }
  return obj;
}

function dedupe(items, opts) {
  opts = opts || {};
  const seen = new Set();
  const out = [];
  let removed = 0;
  for (const item of items) {
    const keyVal = opts.normalized ? sanitize(item) : item;
    const key = JSON.stringify(keyVal);
    if (seen.has(key)) { removed += 1; continue; }
    seen.add(key);
    out.push(item);
  }
  return { items: out, removed, total: items.length };
}

function merge(a, b, mode) {
  mode = mode || 'merge';
  if (mode === 'replace') return { items: b.slice(), added: b.length, removed: a.length };
  if (mode === 'subtract') {
    const set = new Set(b.map((x) => JSON.stringify(x)));
    const out = a.filter((x) => !set.has(JSON.stringify(x)));
    return { items: out, added: 0, removed: a.length - out.length };
  }
  return { items: a.concat(b), added: b.length, removed: 0 };
}

function select(items, indices) {
  const set = new Set(indices);
  return items.filter((_, i) => set.has(i));
}
function erase(items, indices) {
  const set = new Set(indices);
  return items.filter((_, i) => !set.has(i));
}

function shuffle(items, seed) {
  const out = items.slice();
  let s = seed == null ? 12345 : (typeof seed === 'number' ? seed : hashSeed(String(seed)));
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// ---- Bulk transform ----

function replaceText(items, pattern, replacement, opts) {
  opts = opts || {};
  let re;
  if (opts.regex) re = new RegExp(pattern, opts.caseSensitive ? 'g' : 'gi');
  else re = new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let changed = 0;
  const out = items.map((item) => {
    const r = render(item, 'auto');
    const updated = r.text.replace(re, replacement);
    if (updated === r.text) return item;
    changed += 1;
    if (opts.dryRun) return item;
    // For string items return the transformed string; for objects, write back
    // to the first string-valued field that contains the pattern.
    if (typeof item === 'string') return updated;
    if (isPlainObject(item)) {
      const clone = JSON.parse(JSON.stringify(item));
      for (const [k, v] of Object.entries(clone)) {
        if (typeof v === 'string' && re.test(v)) {
          clone[k] = v.replace(re, replacement);
          break;
        }
      }
      return clone;
    }
    return item;
  });
  return { items: out, changed };
}

function replaceField(items, field, value, opts) {
  opts = opts || {};
  let changed = 0;
  const out = items.map((item) => {
    if (!isPlainObject(item) || !(field in item)) return item;
    changed += 1;
    if (opts.dryRun) return item;
    const clone = JSON.parse(JSON.stringify(item));
    if (value === null || value === '__delete__') delete clone[field];
    else clone[field] = value;
    return clone;
  });
  return { items: out, changed };
}

// ---- Export / stats ----

function exportData(items, format) {
  if (format === 'jsonl') return items.map((x) => JSON.stringify(x)).join('\n') + '\n';
  return JSON.stringify(items, null, 2) + '\n';
}

function writeExport(items, filePath, format) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, exportData(items, format || 'json'));
  return { ok: true, path: resolved, items: items.length, format: format || 'json' };
}

function stats(items, opts) {
  opts = opts || {};
  let chars = 0, words = 0, turns = 0;
  const formats = {};
  for (const item of items) {
    const r = render(item, opts.format);
    chars += r.chars; words += r.words; turns += r.turns;
    const f = detectFormat(item);
    formats[f] = (formats[f] || 0) + 1;
  }
  return {
    count: items.length,
    chars, words, turns,
    avgChars: items.length ? Math.round(chars / items.length) : 0,
    avgWords: items.length ? Math.round(words / items.length) : 0,
    formats,
    topNgrams: ngram(items, opts.ngramN || 2, { limit: opts.ngramLimit || 10 }),
  };
}

// ---- MCP tool surface ----

function tools() {
  return [
    { name: 'dataset_stats', description: 'Compute stats (counts, formats, top n-grams) for a local dataset file.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, format: { type: 'string' } }, required: ['path'] } },
    { name: 'dataset_filter', description: 'Filter dataset items by chars/words/turns/matches and regex or substring search.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, regex: { type: 'boolean' }, minWords: { type: 'number' }, maxWords: { type: 'number' }, minTurns: { type: 'number' }, maxTurns: { type: 'number' } }, required: ['path'] } },
    { name: 'dataset_ngram', description: 'Compute n-gram frequencies across a dataset.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, n: { type: 'number' }, limit: { type: 'number' } }, required: ['path'] } },
    { name: 'dataset_dedupe', description: 'Deduplicate a dataset (exact or normalized).', inputSchema: { type: 'object', properties: { path: { type: 'string' }, normalized: { type: 'boolean' } }, required: ['path'] } },
    { name: 'dataset_merge', description: 'Merge, replace, or subtract two local datasets.', inputSchema: { type: 'object', properties: { pathA: { type: 'string' }, pathB: { type: 'string' }, mode: { type: 'string' } }, required: ['pathA', 'pathB'] } },
    { name: 'dataset_replace', description: 'Regex or substring find/replace across dataset items (opt-in dry-run).', inputSchema: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replacement: { type: 'string' }, regex: { type: 'boolean' }, dryRun: { type: 'boolean' } }, required: ['path', 'search'] } },
    { name: 'dataset_export', description: 'Export filtered/transformed items to JSON or JSONL.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, out: { type: 'string' }, format: { type: 'string' } }, required: ['path', 'out'] } },
  ];
}

async function dispatch(name, args) {
  args = args || {};
  if (name === 'dataset_stats') {
    const r = await load(args.path, args);
    return stats(r.items, args);
  }
  if (name === 'dataset_filter') {
    const r = await load(args.path, args);
    const out = filter(r.items, args);
    return { total: r.items.length, matched: out.length, items: out.slice(0, args.limit || 50).map((x) => ({ index: x.index, metrics: x.metrics, matches: x.matches })) };
  }
  if (name === 'dataset_ngram') {
    const r = await load(args.path, args);
    return { total: r.items.length, ngrams: ngram(r.items, args.n || 2, args) };
  }
  if (name === 'dataset_dedupe') {
    const r = await load(args.path, args);
    const d = dedupe(r.items, args);
    return { total: d.total, removed: d.removed, remaining: d.items.length, items: d.items.slice(0, args.limit || 20) };
  }
  if (name === 'dataset_merge') {
    const a = await load(args.pathA, args);
    const b = await load(args.pathB, args);
    const m = merge(a.items, b.items, args.mode || 'merge');
    return { added: m.added, removed: m.removed, total: m.items.length, items: m.items.slice(0, args.limit || 20) };
  }
  if (name === 'dataset_replace') {
    const r = await load(args.path, args);
    const rep = replaceText(r.items, args.search, args.replacement || '', args);
    return { total: r.items.length, changed: rep.changed, dryRun: !!args.dryRun, items: rep.items.slice(0, args.limit || 20) };
  }
  if (name === 'dataset_export') {
    const r = await load(args.path, args);
    let items = r.items;
    if (args.filter) items = filter(items, args.filter).map((x) => x.item);
    return writeExport(items, args.out, args.format || 'json');
  }
  throw new Error('unknown dataset tool: ' + name);
}

module.exports = {
  render, detectFormat, load, parseJsonlStream, parseJsonArrayChunked,
  filter, ngram, sanitize, dedupe, merge, select, erase, shuffle,
  replaceText, replaceField, exportData, writeExport, stats, tools, dispatch,
};
