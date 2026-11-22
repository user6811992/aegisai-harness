// src/tool_eval.js
// Tool-quality eval harness: grade tools by clarity, annotation, token cost, safety.
function grade(tools) {
  const results = (tools || []).map((t) => {
    const f = t.function || t;
    const name = f.name || '';
    const desc = f.description || '';
    const props = (f.parameters && f.parameters.properties) || {};
    const required = (f.parameters && f.parameters.required) || [];
    const issues = [];
    if (!desc || desc.length < 10) issues.push('thin description');
    if (Object.keys(props).length > 8) issues.push('too many parameters');
    if (!f.parameters) issues.push('no parameter schema');
    if (required.length > 5) issues.push('too many required parameters');
    const tokenCost = Math.ceil((name.length + desc.length + JSON.stringify(props).length) / 4);
    return { name, score: Math.max(0, 100 - issues.length * 20 - Math.max(0, tokenCost - 100) / 10), tokenCost, issues };
  });
  return { tools: results.length, average: results.length ? +(results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(1) : 0, results };
}

module.exports = { grade };
