const test = require('node:test');
const assert = require('node:assert');
const tui = require('../src/tui');
const lsp = require('../src/lsp');

test('TUI module loads and has launch', () => {
  assert.ok(typeof tui.launch === 'function');
  assert.ok(typeof tui.Tui === 'function');
  assert.ok(tui.ANSI && tui.ANSI.reset);
});

test('TUI stripAnsi', () => {
  assert.equal(tui.stripAnsi('\x1b[31mred\x1b[0m'), 'red');
});

test('LSP module loads', () => {
  assert.ok(typeof lsp.start === 'function');
  assert.ok(typeof lsp.stop === 'function');
  assert.ok(typeof lsp.hover === 'function');
  assert.ok(typeof lsp.definition === 'function');
  assert.ok(typeof lsp.openDocument === 'function');
  assert.ok(typeof lsp.diagnostics === 'function');
});

test('LSP language servers catalog', () => {
  assert.ok(lsp.LANGUAGE_SERVERS.typescript);
  assert.ok(lsp.LANGUAGE_SERVERS.python);
  assert.ok(lsp.LANGUAGE_SERVERS.go);
});

test('LSP list (none running)', () => {
  assert.deepEqual(lsp.list(), []);
});

test('LSP stop non-existent', () => {
  assert.equal(lsp.stop('nope').ok, false);
});
