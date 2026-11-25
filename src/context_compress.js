// src/context_compress.js
// Smart context compression: instead of truncating old messages, summarize them
// using the model itself (or a heuristic fallback) to preserve key information.
const { backendChat } = require('./backends');

const SUMMARY_PROMPT = 'Summarize the following conversation concisely, preserving key facts, decisions, file paths, and tool results. Output only the summary, no preamble.';

async function summarize(messages, model) {
  if (!messages || messages.length === 0) return '';
  const text = messages.map((m) => (m.role || 'user') + ': ' + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  const body = {
    model: model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
    messages: [{ role: 'system', content: SUMMARY_PROMPT }, { role: 'user', content: text }],
    stream: false,
    maxTokens: 512,
  };
  try {
    const r = await backendChat(body, () => {});
    const content = (r && r.data && r.data.message && r.data.message.content) || '';
    if (content && content.trim().length > 20) return content.trim();
  } catch (e) {}
  // Heuristic fallback: keep first 200 chars of each message, joined.
  return messages.map((m) => '[' + (m.role || 'user') + '] ' + String(m.content || '').slice(0, 200)).join(' | ').slice(0, 2000);
}

function shouldCompress(messages, threshold) {
  const t = threshold || 6000;
  if (!messages || messages.length < 6) return false;
  const chars = messages.reduce((a, m) => a + String(m.content || '').length, 0);
  return chars > t;
}

module.exports = { summarize, shouldCompress };