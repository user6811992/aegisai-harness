// src/tool_discovery.js
// Progressive tool discovery: retrieve relevant tools by query instead of stuffing all schemas.
function score(tool, query) {
  const f = tool.function || tool;
  const name = (f.name || '').toLowerCase();
  const desc = (f.description || '').toLowerCase();
  const q = (query || '').toLowerCase();
  let s = 0;
  for (const word of q.split(/\W+/).filter(Boolean)) {
    if (name.includes(word)) s += 3;
    if (desc.includes(word)) s += 1;
  }
  return s;
}

function discover(tools, query, k) {
  k = k || 12;
  if (!tools || tools.length <= k) return tools;
  const scored = tools.map((t) => ({ t, s: score(t, query) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, k).map((x) => x.t);
}

module.exports = { discover, score };
