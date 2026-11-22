// src/deterministic_compact.js
// Zero-LLM deterministic compaction: query-aware, fail-open, keep errors, recoverable originals.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const { compress } = require('./output_compress');

function compact(messages, opts) {
  opts = opts || {};
  const query = (opts.query || '').toLowerCase();
  const limit = opts.maxChars || 1500;
  const originals = [];
  const out = (messages || []).map((m) => {
    if (m.role === 'tool') {
      const text = String(m.content || '');
      const isError = /error|fail|traceback|exception|blocked/i.test(text);
      originals.push(m);
      if (isError) return Object.assign({}, m, { content: text.slice(0, limit * 2) });
      const keepHead = query ? text.toLowerCase().indexOf(query) === -1 : true;
      return Object.assign({}, m, { content: compress(text, limit) + (keepHead ? '' : '') });
    }
    return m;
  });
  const p = path.join(DATA_DIR, 'compaction-originals');
  fs.mkdirSync(p, { recursive: true });
  const id = 'co_' + Date.now();
  fs.writeFileSync(path.join(p, id + '.json'), JSON.stringify(originals));
  return { messages: out, originalsId: id, compacted: originals.length, failOpen: true };
}
function restore(id) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'compaction-originals', id + '.json'), 'utf8')); } catch (e) { return null; }
}

module.exports = { compact, restore };
