// src/content_review.js
// Content review / slop filter for agent-generated text.
const SLOP = [
  { re: /\b(delve|tapestry|testament|navigate the|landscape|realm|embark|elevate|seamless|robust|cutting-edge|game-changing)\b/gi, label: 'buzzword' },
  { re: /\b(it is important to note|it is worth noting|in today's fast-paced|in conclusion|moreover|furthermore)\b/gi, label: 'hedge/filler' },
  { re: /—/g, label: 'em-dash overuse' },
  { re: /^\s*[-*]\s+.+/gm, label: 'listicle structure' },
];

function review(text) {
  const s = String(text || '');
  const issues = [];
  for (const p of SLOP) {
    const count = (s.match(p.re) || []).length;
    if (count >= (p.label === 'em-dash overuse' ? 4 : 3)) issues.push({ label: p.label, count });
  }
  const words = (s.match(/\S+/g) || []).length;
  return { score: Math.max(0, 100 - issues.reduce((a, i) => a + i.count * 4, 0)), issues, words };
}

module.exports = { review, SLOP };
