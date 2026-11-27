// src/admin_panel_metrics.js
// Performance Dashboard Web UI panel — renders performance_dashboard data as a
// self-contained HTML panel for public/admin.html or docs. No external deps.
const { view } = require('./performance_dashboard');

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function render(opts) {
  opts = opts || {};
  const d = view();
  const total = d.model && d.model.total || {};
  const models = (d.model && d.model.models || []).map(m => `<tr><td>${esc(m.model)}</td><td>${m.runs}</td><td>${m.tokens}</td><td>${m.successRate}%</td></tr>`).join('');
  const net = d.network && d.network.phases || {};
  const phases = Object.entries(net).map(([k,v]) => `<li>${esc(k)}: ${v ? v.mean : 'n/a'} ms</li>`).join('');
  const tools = (d.tools && d.tools.tools || []).slice(0,10).map(t => `<li>${esc(t.name)} — ${t.avgMs} ms (${t.calls}x)</li>`).join('');
  return `<section id="aegisai-performance" style="font-family:system-ui;color:#c9d1d9;background:#0d1117;padding:16px;border-radius:8px">
<h2>Performance Dashboard</h2>
<div>Runs: ${total.runs||0} · Tokens: ${total.tokens||0} · Tools: ${total.tools||0}</div>
<h3>Models</h3><table border="1" cellpadding="4"><tr><th>Model</th><th>Runs</th><th>Tokens</th><th>Success</th></tr>${models}</table>
<h3>Network phases</h3><ul>${phases||'<li>none recorded</li>'}</ul>
<h3>Top tools</h3><ul>${tools||'<li>none recorded</li>'}</ul>
<footer style="opacity:.6;font-size:11px">v${d.version} · generated ${esc(d.generated)}</footer></section>`;
}
function tools() {
  return [{ name: 'dashboard_panel', description: 'Render the performance dashboard as a self-contained HTML panel.', inputSchema: { type: 'object' } }];
}
function dispatch(name){if(name==='dashboard_panel'||name==='dashboard_render')return {ok:true,html:render()};throw new Error('unknown dashboard tool: '+name);}
module.exports = { esc, render, tools, dispatch };
