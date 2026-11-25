// src/tiny_router.js
// Route binary (yes/no) decisions to a small local model, with a deterministic
// heuristic fallback and a bounded cache. Cheap by design: short prompts, low
// temperature, no tools.
const BACKENDS = require('./backends');

const cache = new Map();
const CACHE_MAX = 500;

// Deterministic heuristics used when the model is unavailable or unsure.
const HEURISTICS = [
  { id: 'looks-like-path', test: (q) => /(\.{1,2}\/|\/etc\/|[A-Za-z]:\\|~\/)/.test(q), answer: true, note: 'mentions a filesystem path' },
  { id: 'destructive-verb', test: (q) => /\b(delete|remove|drop|truncate|wipe|format|overwrite)\b/i.test(q), answer: false, note: 'destructive verb → deny by default' },
  { id: 'external-network', test: (q) => /\b(upload|post|send|publish|deploy|push)\b/i.test(q), answer: false, note: 'external side effect → deny by default' },
  { id: 'read-only-verb', test: (q) => /\b(read|list|show|inspect|search|grep|cat)\b/i.test(q), answer: true, note: 'read-only intent' },
  { id: 'secret-material', test: (q) => /\b(token|password|secret|credential|private key)\b/i.test(q), answer: false, note: 'touches credential material' },
];

function heuristic(question) {
  for (const h of HEURISTICS) {
    if (h.test(String(question || ''))) return { answer: h.answer, source: 'heuristic', rule: h.id, note: h.note };
  }
  return { answer: false, source: 'heuristic', rule: 'default-deny', note: 'no rule matched; default deny' };
}

function normalize(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/^(yes|y|true|allow|approve|ok|sure)\b/.test(t)) return true;
  if (/^(no|n|false|deny|reject|refuse|never)\b/.test(t)) return false;
  if (/\b(no|not|never|cannot|can't|shouldn't|must not)\b/.test(t)) return false;
  if (/\byes\b/.test(t)) return true;
  return null;
}

/**
 * decide(question, opts) -> { answer, source, confidence, note }
 * opts: { model, timeoutMs, allowModel }
 */
async function decide(question, opts) {
  opts = opts || {};
  const q = String(question || '').trim();
  if (!q) return { answer: false, source: 'empty', confidence: 1, note: 'empty question' };
  const key = (opts.model || 'default') + '::' + q;
  if (cache.has(key)) return Object.assign({ cached: true }, cache.get(key));

  if (opts.allowModel !== false) {
    const prompt = [
      'Answer strictly with YES or NO. No explanation.',
      'Question: ' + q,
    ].join('\n');
    try {
      const r = await BACKENDS.backendChat({
        model: opts.model || process.env.AEGISAI_TINY_MODEL || process.env.AEGISAI_MODEL || 'llama3.2:3b',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0,
        max_tokens: 4,
        // Signal a short deadline via AbortSignal when the backend supports it.
        signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
      }, () => {});
      const payload = r && r.data ? r.data : r;
      const text = (payload && payload.message && payload.message.content) || (typeof payload === 'string' ? payload : '') || '';
      const parsed = normalize(text);
      if (parsed !== null) {
        const out = { answer: parsed, source: 'model', confidence: 0.8, note: String(text).slice(0, 60) };
        remember(key, out);
        return out;
      }
    } catch (e) { /* fall through to heuristic */ }
  }
  const h = heuristic(q);
  remember(key, h);
  return h;
}

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

function clearCache() { cache.clear(); }
function cacheSize() { return cache.size; }

// Batch helper: evaluate many gates with a single pass (preserves order).
async function decideAll(questions, opts) {
  const out = [];
  for (const q of questions) out.push(await decide(q, opts));
  return out;
}

module.exports = { decide, decideAll, heuristic, normalize, clearCache, cacheSize, HEURISTICS };
