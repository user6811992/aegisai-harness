// src/mcp_security.js
// MCP security scanner: tool poisoning, typosquatting, hidden instructions.
const KNOWN_TOOLS = ['read_file', 'write_file', 'list_files', 'search_files', 'run_command', 'run_python', 'get_state', 'set_state'];

const SUSPICIOUS = [
  { re: /ignore (all )?(previous|prior|system) instructions/i, label: 'prompt injection' },
  { re: /send (data|info|contents) to|exfiltrat|upload to/i, label: 'exfiltration instruction' },
  { re: /do not (tell|mention|report)|secretly|hidden from the user/i, label: 'deceptive instruction' },
  { re: /https?:\/\/\S+/i, label: 'embedded URL in description' },
  { re: /evaluate\(|exec\(|child_process|process\.env/i, label: 'code/credential reference' },
];

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

function scanTool(tool) {
  const f = tool.function || tool;
  const name = f.name || '';
  const desc = f.description || '';
  const issues = [];
  for (const s of SUSPICIOUS) if (s.re.test(desc)) issues.push({ type: s.label, detail: desc.slice(0, 120) });
  // hidden control chars / zero-width
  if (/[\u200B-\u200D\uFEFF\u202E]/.test(desc)) issues.push({ type: 'hidden unicode', detail: 'zero-width/RTL characters in description' });
  // typosquatting
  for (const k of KNOWN_TOOLS) {
    if (name !== k && levenshtein(name, k) <= 1 && name.length >= 4) issues.push({ type: 'typosquatting', detail: name + ' is 1 edit from ' + k });
  }
  // suspicious parameter names
  const props = (f.parameters && f.parameters.properties) || {};
  for (const p of Object.keys(props)) {
    if (/^(api_key|token|password|secret|credential)$/i.test(p)) issues.push({ type: 'credential parameter', detail: p });
  }
  return { name, safe: issues.length === 0, issues };
}

function scanTools(tools) {
  const results = (tools || []).map(scanTool);
  return { safe: results.every((r) => r.safe), results, unsafe: results.filter((r) => !r.safe) };
}

module.exports = { scanTool, scanTools, SUSPICIOUS, levenshtein };
