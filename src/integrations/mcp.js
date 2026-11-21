// src/integrations/mcp.js
// Minimal MCP client (stdio transport). Supports initialize, tools/list, tools/call.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../core/config');

function loadConfig() {
  const p = path.join(DATA_DIR, 'mcp.json');
  if (!fs.existsSync(p)) return { servers: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { servers: [] }; }
}

function saveConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'mcp.json'), JSON.stringify(cfg, null, 2));
}

class McpHttpClient {
  constructor(server) {
    this.server = server;
    this.url = server.url;
    this.headers = Object.assign({ 'Content-Type': 'application/json' }, server.headers || {});
    if (server.apiKey) this.headers['Authorization'] = 'Bearer ' + server.apiKey;
    this.id = 0;
    this.tools = [];
  }
  async start(retries) {
    retries = retries || 3;
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        await this._request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'aegisai-harness', version: '0.2.0' } });
        await this._notify('notifications/initialized', {});
        const r = await this._request('tools/list', {});
        this.tools = (r && r.tools) || [];
        return this;
      } catch (e) {
        lastErr = e;
        await new Promise((res) => setTimeout(res, 500 * (i + 1)));
      }
    }
    throw lastErr;
  }
  async _request(method, params) {
    const id = ++this.id;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const r = await fetch(this.url, { method: 'POST', headers: this.headers, body });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('text/event-stream')) {
      // read SSE until a message with our id
      const text = await r.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        try {
          const msg = JSON.parse(t.slice(5).trim());
          if (msg.id === id) return msg.result;
        } catch (e) {}
      }
      throw new Error('no response for ' + method);
    }
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'rpc error');
    return data.result;
  }
  async _notify(method, params) {
    try { await fetch(this.url, { method: 'POST', headers: this.headers, body: JSON.stringify({ jsonrpc: '2.0', method, params }) }); } catch (e) {}
  }
  async callTool(name, args) {
    // reconnect on failure
    try {
      const r = await this._request('tools/call', { name, arguments: args || {} });
      return r;
    } catch (e) {
      await this.start(2).catch(() => {});
      const r = await this._request('tools/call', { name, arguments: args || {} });
      return r;
    }
  }
  stop() {}
}

class McpClient {
  constructor(server) {
    this.server = server;
    this.proc = null;
    this.id = 0;
    this.pending = new Map();
    this.tools = [];
    this.buffer = '';
  }
  start() {
    if (this.proc) { try { this.proc.kill(); } catch (e) {} this.proc = null; }
    this.pending = new Map();
    this.buffer = '';
    return new Promise((resolve, reject) => {
      const cmd = this.server.command;
      const args = this.server.args || [];
      this.proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
      this.proc.stdout.on('data', (d) => this._onData(d));
      this.proc.stderr.on('data', (d) => { /* ignore */ });
      this.proc.on('error', (e) => reject(e));
      this._request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'aegisai-harness', version: '0.1.0' } })
        .then(() => this._notify('notifications/initialized', {}))
        .then(() => this._request('tools/list', {}))
        .then((r) => { this.tools = (r && r.tools) || []; resolve(this); })
        .catch(reject);
    });
  }
  _onData(d) {
    this.buffer += d.toString();
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          resolve(msg.result);
        }
      } catch (e) {}
    }
  }
  _request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.proc.stdin.write(msg);
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout: ' + method)); } }, 30000);
    });
  }
  _notify(method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this.proc.stdin.write(msg);
    return Promise.resolve();
  }
  async callTool(name, args) {
    try {
      return await this._request('tools/call', { name, arguments: args || {} });
    } catch (e) {
      // attempt reconnect
      try { await this.start(); } catch (e2) {}
      return await this._request('tools/call', { name, arguments: args || {} });
    }
  }
  stop() {
    if (this.proc) { try { this.proc.kill(); } catch (e) {} this.proc = null; }
  }
}

async function connectAll() {
  const cfg = loadConfig();
  const clients = [];
  for (const s of (cfg.servers || [])) {
    if (s.enabled === false) continue;
    const transport = (s.transport || (s.url ? 'http' : 'stdio')).toLowerCase();
    try {
      let c;
      if (transport === 'http' || transport === 'sse') {
        c = new McpHttpClient(s);
        await c.start(3);
      } else {
        c = new McpClient(s);
        await c.start();
      }
      clients.push({ config: Object.assign({}, s, { transport }), client: c });
    } catch (e) {
      // skip failed servers
    }
  }
  return clients;
}

function aggregateTools(clients) {
  const tools = [];
  for (const { config, client } of clients) {
    const prefix = (config.name || 'mcp') + '_';
    for (const t of client.tools) {
      tools.push({ src: config.name || 'mcp', name: t.name, description: t.description, inputSchema: t.inputSchema, client });
    }
  }
  return tools;
}

module.exports = { loadConfig, saveConfig, McpClient, connectAll, aggregateTools };
