// src/tokenizer.js
// Local approximate token counting (no network, no external deps).
function countTokens(text) {
  if (!text) return 0;
  // rough BPE approximation: words + punctuation, ~4 chars/token for English
  const s = String(text);
  const words = s.match(/\S+/g) || [];
  return Math.ceil(s.length / 4) + Math.floor(words.length * 0.3);
}

function countMessages(messages) {
  let total = 0;
  for (const m of messages || []) total += countTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')) + 4;
  return total;
}

module.exports = { countTokens, countMessages };
