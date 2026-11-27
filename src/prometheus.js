// src/prometheus.js
// Prometheus /metrics text exposition — feeds performance_dashboard and external
// dashboards. Clean-room dashboard-llm pattern. No external deps, local-only.
const os = require('os');
const { VERSION } = require('./version');

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'); }
function gauge(name, value, labels, help) {
  const l = labels && Object.keys(labels).length ? '{' + Object.entries(labels).map(([k,v]) => `${k}="${esc(v)}"`).join(',') + '}' : '';
  return (help ? `# HELP ${name} ${help}\n# TYPE ${name} gauge\n` : '') + `${name}${l} ${value}`;
}

function collect(opts) {
  opts = opts || {};
  const stats = opts.stats || {};
  const hw = opts.hardware || {};
  const lines = [
    `# AegisAi Harness metrics v${VERSION}`,
    gauge('aegisai_info', 1, { version: VERSION }, 'Harness build info'),
    gauge('aegisai_cpu_cores', os.cpus().length, {}, 'CPU logical cores'),
    gauge('aegisai_memory_total_bytes', os.totalmem(), {}, 'Total system RAM'),
    gauge('aegisai_memory_free_bytes', os.freemem(), {}, 'Free system RAM'),
  ];
  if (hw.gpu && hw.gpu.detected) lines.push(gauge('aegisai_gpu_detected', 1, { info: hw.gpu.info.slice(0, 100) }, 'GPU detected'));
  if (stats.total) {
    lines.push(gauge('aegisai_runs_total', stats.total.runs || 0, {}, 'Model runs'));
    lines.push(gauge('aegisai_tokens_total', stats.total.tokens || 0, {}, 'Tokens used'));
    lines.push(gauge('aegisai_tools_total', stats.total.tools || 0, {}, 'Tool calls'));
  }
  for (const m of (stats.models || [])) {
    lines.push(gauge('aegisai_model_tokens', m.tokens || 0, { model: m.model }, 'Tokens by model'));
    lines.push(gauge('aegisai_model_success_rate', m.successRate || 0, { model: m.model }, 'Success rate % by model'));
  }
  return lines.join('\n') + '\n';
}

function tools() {
  return [{ name: 'prometheus_metrics', description: 'Render Prometheus /metrics exposition from local harness stats.', inputSchema: { type: 'object' } }];
}
function dispatch(name, args) {
  if (name === 'prometheus_metrics') return { ok: true, text: collect(args || {}) };
  throw new Error('unknown prometheus tool: ' + name);
}
module.exports = { esc, gauge, collect, tools, dispatch };
