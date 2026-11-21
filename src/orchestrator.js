// src/orchestrator.js
// DAG orchestrator with multi-critic evaluation and bounded retries.
const dag = require('./dag');
const critic = require('./critic');
const { runAgent } = require('./agent/run');

async function run(nodes, opts) {
  opts = opts || {};
  const waves = dag.waves(nodes);
  const results = {};
  const log = [];
  let retryCount = 0;
  const maxRetries = opts.maxRetries || 1;
  for (const wave of waves) {
    const waveResults = await Promise.all(wave.map(async (node) => {
      const deps = (node.deps || []).map((d) => results[d] || '').join('\n');
      const prompt = (deps ? 'Context from dependencies:\n' + deps + '\n\n' : '') + (node.prompt || '');
      let output = '';
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const r = await runAgent({
          model: node.model || opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
          messages: [{ role: 'user', content: prompt }],
          projectRoot: opts.projectRoot || process.cwd(),
          autoApprove: true,
          onEvent: () => {},
        });
        output = (r.final && r.final.final) || '';
        if (!opts.critics || opts.critics.length === 0) break;
        const ev = await critic.critique(node.id, output, { critics: opts.critics, threshold: opts.threshold || 6, model: opts.criticModel });
        log.push({ node: node.id, attempt, evaluation: ev });
        if (ev.verdict) break;
        retryCount += 1;
      }
      return { id: node.id, output };
    }));
    for (const r of waveResults) results[r.id] = r.output;
  }
  const runRec = { nodes: nodes.length, waves: waves.length, retries: retryCount, results, log };
  const id = dag.saveRun(runRec);
  return { id, ...runRec };
}

module.exports = { run };
