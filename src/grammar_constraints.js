// src/grammar_constraints.js
// GBNF grammar-constrained generation — clean-room HyperMink/inferenceable
// idea. Build small GBNF grammars for structured output (JSON enums, numbers).
// No backend bundled; returns grammar text for the caller's decoder.
function esc(s) { return String(s).replace(/"/g, '\\"'); }
function fromEnum(values) {
  const alts = (values || []).map((v) => `"${esc(v)}"`).join(' | ');
  return { ok: true, grammar: `root ::= ${alts || '""'}\n`, values: values || [] };
}
function jsonSchema(schema) {
  const fields = Object.entries(schema || {}).map(([k, v]) => `"${esc(k)}" ":" ${v === 'number' ? '-?[0-9]+' : v === 'boolean' ? '("true" | "false")' : '"[^"]*"'}`).join(', ');
  return { ok: true, grammar: `root ::= "{" ${fields} "}"\n`, note: 'minimal GBNF subset; validate against your decoder' };
}
function tools() {
  return [
    { name: 'grammar_enum', description: 'Build a GBNF enum grammar.', inputSchema: { type: 'object', properties: { values: { type: 'array' } }, required: ['values'] } },
    { name: 'grammar_json', description: 'Build a minimal GBNF JSON-object grammar.', inputSchema: { type: 'object', properties: { schema: { type: 'object' } }, required: ['schema'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'grammar_enum') return fromEnum(args.values);
  if (name === 'grammar_json') return jsonSchema(args.schema);
  throw new Error('unknown grammar_constraints tool: ' + name);
}
module.exports = { esc, fromEnum, jsonSchema, tools, dispatch };
