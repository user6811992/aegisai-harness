// src/lenient_parse.js
// Lenient tool-call parsing fallback for small/uncensored models.
function parse(text) {
  const s = String(text || '');
  const out = [];
  // fenced JSON
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  for (const f of fenced) tryParse(f.replace(/```(?:json)?/gi, ''), out);
  // raw JSON objects
  tryParse(s, out);
  // XML-ish <tool>name</tool><args>{...}</args>
  const re = /<(?:tool|tool_name)>([\w.]+)<\/(?:tool|tool_name)>[\s\S]*?<(?:args|arguments)>([\s\S]*?)<\/(?:args|arguments)>/gi;
  let m;
  while ((m = re.exec(s))) {
    let args = {};
    try { args = JSON.parse(m[2]); } catch (e) {}
    out.push({ name: m[1].trim(), arguments: args });
  }
  // plain "tool_name: {...}"
  const re2 = /(?:^|\n)\s*([\w.]+)\s*:\s*(\{[\s\S]*?\})/g;
  while ((m = re2.exec(s))) {
    let args = {};
    try { args = JSON.parse(m[2]); } catch (e) {}
    if (args && typeof args === 'object') out.push({ name: m[1].trim(), arguments: args });
  }
  // dedupe
  const seen = new Set();
  return out.filter((c) => { const k = c.name + JSON.stringify(c.arguments); if (seen.has(k)) return false; seen.add(k); return true; });
}
function tryParse(text, out) {
  const s = String(text || '').trim();
  if (!s) return;
  try {
    const j = JSON.parse(s);
    const calls = Array.isArray(j) ? j : (j.tool_calls || (j.name ? [j] : []));
    for (const c of calls || []) {
      const f = c.function || c;
      if (f.name) out.push({ name: f.name, arguments: typeof f.arguments === 'string' ? safeJson(f.arguments) : (f.arguments || {}) });
    }
  } catch (e) {}
}
function safeJson(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

module.exports = { parse, safeJson };
