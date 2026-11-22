// src/citations.js
// Extract and render web citations from streamed replies.
function extract(text) {
  const out = [];
  const re = /\[(\d+)\]\s*\(?(https?:\/\/[^)\s]+)\)?/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push({ index: Number(m[1]), url: m[2] });
  const bare = /https?:\/\/[^\s<]+/g;
  while ((m = bare.exec(String(text || '')))) if (!out.some((c) => c.url === m[0])) out.push({ index: out.length + 1, url: m[0] });
  return out;
}
function render(text) {
  const cites = extract(text);
  if (!cites.length) return { text, citations: [] };
  const body = cites.reduce((s, c) => s.replace(c.url, '[' + c.index + ']'), String(text));
  return { text: body, citations: cites };
}

module.exports = { extract, render };
