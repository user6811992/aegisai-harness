// src/waste.js
// Detect wasted effort: over-verification, repeated calls, false completion.
const verifier = require('./verifier');

function detect(toolLog, finalText) {
  const log = toolLog || [];
  const flags = [];
  const counts = {};
  for (const t of log) counts[t.name] = (counts[t.name] || 0) + 1;
  for (const [name, n] of Object.entries(counts)) {
    if (n >= 4) flags.push({ type: 'over-verification', detail: name + ' called ' + n + ' times' });
  }
  const reads = log.filter((t) => t.name === 'read_file');
  const readPaths = reads.map((t) => t.args?.path || t.args?.file_path);
  const dup = readPaths.filter((p, i) => readPaths.indexOf(p) !== i);
  if (dup.length) flags.push({ type: 'repeated-read', detail: 'same file read ' + (dup.length + 1) + ' times: ' + dup[0] });
  if (finalText) {
    const v = verifier.verify(finalText, log);
    if (!v.verified) flags.push({ type: 'false-completion', detail: v.issues.join('; ') });
  }
  return { wasteful: flags.length > 0, flags, toolCount: log.length };
}

module.exports = { detect };
