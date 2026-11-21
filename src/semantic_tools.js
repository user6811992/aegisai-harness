// src/semantic_tools.js
// Dense + hybrid semantic tool retrieval (feature-hash embeddings, no external deps).
function embed(text) {
  const v = new Array(64).fill(0);
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const w of words) {
    let h = 0;
    for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) >>> 0;
    v[h % 64] += 1;
  }
  return v;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
function retrieve(tools, query, k) {
  k = k || 12;
  const q = embed(query);
  const scored = (tools || []).map((t) => {
    const f = t.function || t;
    const text = (f.name || '') + ' ' + (f.description || '');
    const dense = cosine(q, embed(text));
    const kw = String(text).toLowerCase().includes(String(query || '').toLowerCase()) ? 0.2 : 0;
    return { tool: t, score: dense + kw };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.tool);
}

module.exports = { embed, cosine, retrieve };
