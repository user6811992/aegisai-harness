// src/agent/compact.js
// Context compaction: summarize older messages into a single summary message.
const backends = require('../backends');

async function summarize(messages, model, onChunk) {
  const text = messages.map((m) => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n');
  const prompt = [
    { role: 'system', content: 'You are a concise summarizer. Summarize the conversation below, preserving key facts, decisions, file paths, and open tasks. Output only the summary.' },
    { role: 'user', content: text },
  ];
  try {
    const resp = await backends.backendChat({ model, messages: prompt, tools: [], stream: false, maxTokens: 512 }, onChunk);
    const data = resp && resp.data ? resp.data : resp;
    const msg = (data && data.message) || {};
    return msg.content || '';
  } catch (e) {
    return '';
  }
}

// Compact: keep system messages + last `keep` non-system messages; summarize the rest.
async function compactMessages(opts) {
  opts = opts || {};
  const messages = opts.messages || [];
  const model = opts.model;
  const keep = opts.keep || 8;
  const threshold = opts.threshold || 16;
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const others = messages.filter((m) => m.role !== 'system');
  if (others.length <= threshold) return messages;
  const toSummarize = others.slice(0, others.length - keep);
  const kept = others.slice(others.length - keep);
  const summary = await summarize(toSummarize, model);
  const out = [...systemMsgs];
  if (summary) {
    out.push({ role: 'system', content: 'Conversation summary (compacted):\n' + summary });
  }
  out.push(...kept);
  return out;
}

module.exports = { compactMessages, summarize };
