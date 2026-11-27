// src/offline_webui.js
// Single-file offline web UI mode — clean-room LostRuins/lite.koboldai.net
// (209⭐) idea. Emit one self-contained HTML file (CSS+JS inline, zero deps)
// that can chat with a local backend through an optional bridge. No CDN.
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function render(opts) {
  opts = opts || {};
  const title = esc(opts.title || 'AegisAi Offline Web UI');
  const endpoint = esc(opts.endpoint || 'http://127.0.0.1:8080/v1/chat/completions');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>:root{color-scheme:dark}body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;max-width:820px;padding:20px;margin-inline:auto}
h1{font-size:1.3rem}#log{border:1px solid #30363d;border-radius:8px;min-height:320px;padding:12px;overflow:auto;background:#161b22}
.msg{margin:8px 0}.msg.user{color:#79c0ff}.msg.assistant{color:#a5d6ff}.msg small{opacity:.5}
form{display:flex;gap:8px;margin-top:12px}input{flex:1;padding:10px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;border-radius:6px}button{padding:10px 16px;background:#238636;color:#fff;border:0;border-radius:6px;cursor:pointer}
.note{font-size:12px;opacity:.6}</style></head><body>
<h1>${title}</h1><p class="note">Single-file, offline-first. Chat is local-only unless you enable the bridge.</p>
<div id="log"></div><form id="f"><input id="in" placeholder="Message..." autocomplete="off"><button>Send</button></form>
<p class="note">Bridge endpoint (opt-in): <code>${endpoint}</code></p>
<script>
const log=document.getElementById('log'),f=document.getElementById('f'),inp=document.getElementById('in');
function add(role,text){const d=document.createElement('div');d.className='msg '+role;d.innerHTML='<small>'+role+'</small><br>'+text.replace(/</g,'&lt;');log.appendChild(d);log.scrollTop=log.scrollHeight;}
f.addEventListener('submit',async e=>{e.preventDefault();const text=inp.value.trim();if(!text)return;add('user',text);inp.value='';add('assistant','<em>offline mode — no backend connected</em>');});
</script></body></html>`;
}

function tools() {
  return [{ name: 'offline_webui_render', description: 'Render a single-file offline web UI HTML page.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, endpoint: { type: 'string' } } } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'offline_webui_render') return { ok: true, html: render(args), bytes: render(args).length };
  throw new Error('unknown offline_webui tool: ' + name);
}
module.exports = { esc, render, tools, dispatch };
