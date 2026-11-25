// src/tui.js
// Terminal workbench (TUI): multi-pane layout with status bar, chat, sidebar, command palette.
const readline = require('readline');
const { EventEmitter } = require('events');

const ANSI = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  fg: { black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m', gray: '\x1b[90m' },
  bg: { black: '\x1b[40m', blue: '\x1b[44m', cyan: '\x1b[46m' },
  clear: '\x1b[2J\x1b[H', hideCursor: '\x1b[?25l', showCursor: '\x1b[?25h',
  move: (r, c) => '\x1b[' + r + ';' + c + 'H', clearLine: '\x1b[2K',
};

function size() { return { cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 }; }

class Tui extends EventEmitter {
  constructor(opts) {
    super();
    opts = opts || {};
    this.title = opts.title || 'AegisAi Harness';
    this.messages = [];
    this.status = opts.status || 'ready';
    this.sidebar = opts.sidebar || [];
    this.input = '';
    this.cursor = 0;
    this.running = false;
    this.rl = null;
  }
  start() {
    this.running = true;
    this._stopped = false;
    process.stdout.write(ANSI.hideCursor + ANSI.clear);
    this.render();
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true, prompt: '' });
    process.stdin.setRawMode && process.stdin.setRawMode(true);
    this._onData = (d) => this.handleKey(d);
    this._onResize = () => this.render();
    this._onSigint = () => this.stop();
    process.stdin.on('data', this._onData);
    process.on('SIGWINCH', this._onResize);
    process.on('SIGINT', this._onSigint);
  }
  stop() {
    if (this._stopped) return;
    this._stopped = true;
    this.running = false;
    // Detach listeners so the process can exit after Ctrl+C.
    try { if (this._onData) process.stdin.off('data', this._onData); } catch (e) {}
    try { if (this._onResize) process.off('SIGWINCH', this._onResize); } catch (e) {}
    try { if (this._onSigint) process.off('SIGINT', this._onSigint); } catch (e) {}
    try { process.stdin.pause(); } catch (e) {}
    process.stdin.setRawMode && process.stdin.setRawMode(false);
    process.stdout.write(ANSI.showCursor + ANSI.clear + ANSI.reset);
    if (this.rl) { try { this.rl.close(); } catch (e) {} this.rl = null; }
    this.emit('exit');
  }
  handleKey(d) {
    const s = d.toString();
    if (!s) return;
    if (s === '\u0003') { this.stop(); return; } // Ctrl+C
    // Bracketed paste: ESC[200~ ... ESC[201~. Process the content between the
    // markers as literal text (newlines become spaces, no auto-submit).
    if (s.includes('\x1b[200~') || s.includes('\x1b[201~') || this._pasteBuffer !== undefined) {
      if (this._pasteBuffer === undefined) this._pasteBuffer = '';
      const parts = s.split(/\x1b\[200~|\x1b\[201~/);
      let buf = this._pasteBuffer;
      for (const chunk of parts) buf += chunk.replace(/\r?\n/g, ' ').replace(/[^\x20-\x7e\t]/g, '');
      if (s.includes('\x1b[201~')) {
        const text = buf.trim();
        if (text) this.input += (this.input ? ' ' : '') + text;
        this._pasteBuffer = undefined;
        this.render();
        return;
      }
      this._pasteBuffer = buf;
      this.render();
      return;
    }
    // Split pasted/multi-byte chunks into lines and printable runs.
    if (s === '\r' || s === '\n') {
      const cmd = this.input.trim();
      this.input = '';
      this.emit('command', cmd);
      if (cmd) this.addMessage('user', cmd);
      this.render();
      return;
    }
    if (s === '\u007f' || s === '\b') { // backspace
      this.input = this.input.slice(0, -1);
      this.render();
      return;
    }
    if (s.startsWith('\x1b[') || s.startsWith('\x1bO')) return; // ignore escape sequences
    // A pasted block (multi-char, may contain newlines) is inserted verbatim so the
    // user can review/edit it; only a bare Enter submits. Newlines become spaces
    // because the input is single-line.
    const printable = s.replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7e\t]/g, '');
    if (printable) {
      this.input += printable;
      this.render();
    }
  }
  addMessage(role, content) {
    this.messages.push({ role, content, at: new Date().toLocaleTimeString() });
    if (this.messages.length > 200) this.messages.shift();
    this.render();
  }
  setStatus(s) { this.status = s; this.render(); }
  setSidebar(items) { this.sidebar = items; this.render(); }
  render() {
    if (!this.running) return;
    const { cols, rows } = size();
    const sidebarWidth = Math.min(30, Math.floor(cols * 0.25));
    const chatWidth = cols - sidebarWidth - 1;
    const statusRow = rows;
    const inputRow = rows - 1;
    const chatRows = rows - 3;
    let out = ANSI.move(1, 1);
    // Header
    out += ANSI.bold + ANSI.fg.cyan + this.title + ANSI.reset + ANSI.dim + '  (Ctrl+C to exit)' + ANSI.reset + '\n';
    out += '─'.repeat(cols) + '\n';
    // Sidebar + chat
    const sidebarLines = this.sidebar.slice(0, chatRows);
    for (let r = 0; r < chatRows; r++) {
      out += ANSI.move(3 + r, 1);
      // chat area
      const msgIdx = this.messages.length - chatRows + r;
      let chatCell = '';
      if (msgIdx >= 0 && msgIdx < this.messages.length) {
        const m = this.messages[msgIdx];
        const prefix = m.role === 'user' ? ANSI.fg.green + '> ' : ANSI.fg.blue + '  ';
        chatCell = prefix + sanitizeLine(m.content).slice(0, chatWidth - 3) + ANSI.reset;
      }
      // pad chat
      const pad = Math.max(0, chatWidth - stripAnsi(chatCell).length);
      out += chatCell + ' '.repeat(pad);
      // sidebar
      out += ANSI.dim + '│' + ANSI.reset;
      const sl = sidebarLines[r] || '';
      out += ANSI.dim + sanitizeLine(sl).slice(0, sidebarWidth - 1) + ANSI.reset;
    }
    // Input line
    out += ANSI.move(inputRow, 1) + ANSI.clearLine;
    out += ANSI.fg.green + '> ' + ANSI.reset + sanitizeLine(this.input) + ANSI.showCursor;
    // Status bar
    out += ANSI.move(statusRow, 1) + ANSI.clearLine;
    const statusSafe = sanitizeLine(this.status);
    out += ANSI.bg.blue + ANSI.fg.white + ANSI.bold + ' ' + statusSafe + ' '.repeat(Math.max(0, cols - statusSafe.length - 1)) + ANSI.reset;
    process.stdout.write(out);
  }
}

function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ''); }

// Make untrusted text safe for a single TUI row: drop ANSI/control sequences and
// collapse newlines so a message cannot break the layout.
function sanitizeLine(s) {
  return String(s == null ? '' : s)
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

function launch(opts) {
  const tui = new Tui(opts);
  tui.start();
  return tui;
}

module.exports = { Tui, launch, ANSI, stripAnsi, sanitizeLine };
