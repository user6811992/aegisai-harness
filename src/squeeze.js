// src/squeeze.js
// Squeeze tool: read a long doc/URL and extract only the answer to a question.
const fs = require('fs');
const { fromUrl } = require('./markdown_extract');
const { runAgent } = require('./agent/run');

async function squeeze(source, question, opts) {
  opts = opts || {};
  let text;
  if (/^https?:\/\//.test(source)) text = await fromUrl(source);
  else { try { text = fs.readFileSync(source, 'utf8'); } catch (e) { return { ok: false, error: String(e.message || e) }; } }
  if (String(text).startsWith('error:')) return { ok: false, error: text };
  const prompt = 'Answer this question using only the document below. Be concise. If the answer is not present, say "not found".\n\nQuestion: ' + question + '\n\nDocument:\n' + String(text).slice(0, 30000);
  try {
    const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: process.cwd(), autoApprove: true, planMode: true, onEvent: () => {} });
    return { ok: true, answer: (r.final && r.final.final) || '', source, question };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

module.exports = { squeeze };
