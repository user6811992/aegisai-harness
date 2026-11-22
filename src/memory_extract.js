// src/memory_extract.js
// LLM-driven durable fact extraction from conversations.
const { runAgent } = require('./agent/run');
const sourceMemory = require('./source_memory');

async function extract(messages, opts) {
  opts = opts || {};
  const text = (messages || []).map((m) => m.role + ': ' + String(m.content || '').slice(0, 1000)).join('\n').slice(0, 12000);
  if (!text.trim()) return { extracted: [], notes: 'empty conversation' };
  const prompt = 'Extract durable facts worth remembering from this conversation. Return one fact per line, nothing else.\n\n' + text;
  let lines = [];
  try {
    const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: process.cwd(), autoApprove: true, planMode: true, onEvent: () => {} });
    lines = String((r.final && r.final.final) || '').split(/\r?\n/).map((l) => l.replace(/^[-*]\s*/, '').trim()).filter((l) => l.length > 8).slice(0, 15);
  } catch (e) { return { extracted: [], error: String(e.message || e) }; }
  const saved = [];
  for (const line of lines) { const id = sourceMemory.remember(line, opts.source || 'auto-extract', ['auto']); saved.push(id); }
  return { extracted: saved, count: saved.length };
}

module.exports = { extract };
