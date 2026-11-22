// src/lsp.js
// Language Server Protocol client: spawn language servers, JSON-RPC over stdio.
const { spawn } = require('child_process');
const path = require('path');

const servers = new Map(); // language -> { proc, buffer, pending, nextId, rootUri }

const LANGUAGE_SERVERS = {
  typescript: { cmd: 'typescript-language-server', args: ['--stdio'], install: 'npm i -g typescript-language-server typescript' },
  javascript: { cmd: 'typescript-language-server', args: ['--stdio'], install: 'npm i -g typescript-language-server typescript' },
  python: { cmd: 'pylsp', args: [], install: 'pip install python-lsp-server' },
  go: { cmd: 'gopls', args: [], install: 'go install golang.org/x/tools/gopls@latest' },
  rust: { cmd: 'rust-analyzer', args: [], install: 'rustup component add rust-analyzer' },
};

function rootUri(root) { return 'file://' + path.resolve(root).replace(/\\/g, '/'); }

function start(language, root) {
  const spec = LANGUAGE_SERVERS[language];
  if (!spec) return { ok: false, error: 'unknown language: ' + language };
  if (servers.has(language)) return { ok: true, note: 'already running', language };
  let proc;
  try { proc = spawn(spec.cmd, spec.args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: root || process.cwd() }); }
  catch (e) { return { ok: false, error: 'spawn failed: ' + e.message, install: spec.install }; }
  const state = { proc, buffer: '', pending: new Map(), nextId: 1, rootUri: rootUri(root || process.cwd()), language, diagnostics: new Map() };
  proc.stdout.on('data', (d) => {
    state.buffer += d.toString('utf8');
    // parse LSP messages: Content-Length header + body
    while (true) {
      const headerEnd = state.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = state.buffer.slice(0, headerEnd);
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) { state.buffer = state.buffer.slice(headerEnd + 4); continue; }
      const len = parseInt(m[1], 10);
      const bodyStart = headerEnd + 4;
      if (state.buffer.length < bodyStart + len) break;
      const body = state.buffer.slice(bodyStart, bodyStart + len);
      state.buffer = state.buffer.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body);
        if (msg.id !== undefined && state.pending.has(msg.id)) {
          const { resolve } = state.pending.get(msg.id);
          state.pending.delete(msg.id);
          resolve(msg);
        }
        if (msg.method === 'textDocument/publishDiagnostics') {
          state.diagnostics.set(msg.params.uri, msg.params.diagnostics || []);
        }
      } catch (e) { /* ignore */ }
    }
  });
  proc.on('error', (e) => { servers.delete(language); });
  proc.on('exit', () => { servers.delete(language); });
  servers.set(language, state);

  // initialize
  sendRequest(state, 'initialize', { processId: process.pid, rootUri: state.rootUri, capabilities: { textDocument: { hover: { contentFormat: ['plaintext'] }, definition: { linkSupport: false }, completion: { completionItem: { snippetSupport: false } }, diagnostic: {} } } }).then((resp) => {
    sendNotification(state, 'initialized', {});
  }).catch(() => {});

  return { ok: true, language, pid: proc.pid };
}

function sendRequest(state, method, params) {
  return new Promise((resolve, reject) => {
    const id = state.nextId++;
    state.pending.set(id, { resolve, reject });
    const msg = { jsonrpc: '2.0', id, method, params };
    const body = JSON.stringify(msg);
    state.proc.stdin.write('Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
    setTimeout(() => { if (state.pending.has(id)) { state.pending.delete(id); reject(new Error('timeout: ' + method)); } }, 15000);
  });
}
function sendNotification(state, method, params) {
  const msg = { jsonrpc: '2.0', method, params };
  const body = JSON.stringify(msg);
  state.proc.stdin.write('Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
}

async function request(language, method, params) {
  const state = servers.get(language);
  if (!state) return { ok: false, error: 'server not running for ' + language };
  try { const resp = await sendRequest(state, method, params); return { ok: true, result: resp.result, error: resp.error }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function stop(language) {
  const state = servers.get(language);
  if (!state) return { ok: false, error: 'not running' };
  try { sendRequest(state, 'shutdown', {}).then(() => sendNotification(state, 'exit', {})).catch(() => {}); } catch (e) {}
  setTimeout(() => { try { state.proc.kill(); } catch (e) {} }, 1000);
  servers.delete(language);
  return { ok: true };
}
function stopAll() { for (const lang of [...servers.keys()]) stop(lang); }
function list() { return [...servers.keys()].map((lang) => ({ language: lang, pid: servers.get(lang).proc.pid, rootUri: servers.get(lang).rootUri })); }
function diagnostics(language, uri) { const state = servers.get(language); if (!state) return []; return state.diagnostics.get(uri) || []; }
function allDiagnostics(language) { const state = servers.get(language); if (!state) return {}; return Object.fromEntries(state.diagnostics); }

// High-level helpers
async function hover(language, file, line, character) {
  const uri = 'file://' + path.resolve(file).replace(/\\/g, '/');
  return request(language, 'textDocument/hover', { textDocument: { uri }, position: { line: line - 1, character: character - 1 } });
}
async function definition(language, file, line, character) {
  const uri = 'file://' + path.resolve(file).replace(/\\/g, '/');
  return request(language, 'textDocument/definition', { textDocument: { uri }, position: { line: line - 1, character: character - 1 } });
}
async function completions(language, file, line, character) {
  const uri = 'file://' + path.resolve(file).replace(/\\/g, '/');
  return request(language, 'textDocument/completion', { textDocument: { uri }, position: { line: line - 1, character: character - 1 } });
}
function openDocument(language, file) {
  const state = servers.get(language);
  if (!state) return { ok: false, error: 'server not running' };
  const uri = 'file://' + path.resolve(file).replace(/\\/g, '/');
  let text = '';
  try { text = require('fs').readFileSync(file, 'utf8'); } catch (e) { return { ok: false, error: String(e.message || e) }; }
  sendNotification(state, 'textDocument/didOpen', { textDocument: { uri, languageId: language, version: 1, text } });
  return { ok: true, uri };
}

module.exports = { start, stop, stopAll, list, request, hover, definition, completions, openDocument, diagnostics, allDiagnostics, LANGUAGE_SERVERS };
