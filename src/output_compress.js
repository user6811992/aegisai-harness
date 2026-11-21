// src/output_compress.js
// Content-aware tool output compression before it reaches the model.
function compress(text, maxChars) {
  if (text == null) return '';
  const s = String(text);
  maxChars = maxChars || 2000;
  if (s.length <= maxChars) return s;
  const head = Math.floor(maxChars * 0.4);
  const tail = Math.floor(maxChars * 0.4);
  return s.slice(0, head) + '\n... [truncated ' + (s.length - head - tail) + ' chars] ...\n' + s.slice(-tail);
}

module.exports = { compress };
