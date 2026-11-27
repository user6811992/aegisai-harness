const { test } = require('node:test');
const assert = require('node:assert');
const guards = require('../src/tool_guardrails');

// ---- rescue parsing ----

test('guards: rescueParse repairs clean JSON without rescue', () => {
  const r = guards.rescueParse({ function: { name: 'read_file', arguments: '{"path":"a.txt"}' } });
  assert.equal(r.rescued, false);
  assert.deepEqual(r.args, { path: 'a.txt' });
  assert.equal(r.name, 'read_file');
});

test('guards: rescueParse strips code fences and leading prose', () => {
  const r = guards.rescueParse({ function: { name: 'read_file', arguments: 'Here: ```json\n{"path":"b.txt"}\n```' } });
  assert.equal(r.rescued, true);
  assert.deepEqual(r.args, { path: 'b.txt' });
});

test('guards: rescueParse repairs truncated JSON', () => {
  const r = guards.rescueParse({ function: { name: 'edit', arguments: '{"path":"x","old":"a","new":"b"' } });
  assert.equal(r.rescued, true);
  assert.equal(r.args.path, 'x');
  assert.equal(r.args.new, 'b');
});

test('guards: rescueParse extracts key=value last resort', () => {
  const r = guards.rescueParse({ function: { name: 'get_time', arguments: 'timezone: "UTC"' } });
  assert.equal(r.rescued, true);
  assert.equal(r.args.timezone, 'UTC');
});

test('guards: rescueParse handles non-object args', () => {
  const r = guards.rescueParse({ function: { name: 'x', arguments: 42 } });
  assert.deepEqual(r.args, {});
  assert.equal(r.rescued, true);
});

// ---- guardToolCall ----

test('guards: guardToolCall allows valid call', () => {
  const r = guards.guardToolCall({ function: { name: 'read_file', arguments: '{"path":"a"}' } });
  assert.equal(r.ok, true);
  assert.equal(r.issues.length, 0);
});

test('guards: guardToolCall enforces allowed/denied lists', () => {
  const base = { function: { name: 'run_command', arguments: '{}' } };
  assert.equal(guards.guardToolCall(base, { allowedTools: ['read_file'] }).ok, false);
  assert.equal(guards.guardToolCall(base, { deniedTools: ['run_command'] }).ok, false);
});

test('guards: guardToolCall flags missing name', () => {
  const r = guards.guardToolCall({ function: { arguments: '{}' } });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('missing tool name')));
});

// ---- validateResponse / nudge ----

test('guards: validateResponse accepts good output', () => {
  const v = guards.validateResponse('read_file', { ok: true, output: 'file content' });
  assert.equal(v.valid, true);
});

test('guards: validateResponse detects empty and placeholder output', () => {
  assert.equal(guards.validateResponse('x', { ok: true, output: '' }).valid, false);
  assert.equal(guards.validateResponse('x', { ok: true, output: '[object Object]' }).valid, false);
  assert.equal(guards.validateResponse('x', { ok: false }).valid, false);
});

test('guards: nudge returns corrective message only on failure', () => {
  assert.equal(guards.nudge('x', {}, { ok: true, output: 'ok' }), null);
  const n = guards.nudge('read_file', {}, { ok: true, output: '' });
  assert.ok(n);
  assert.equal(n.role, 'user');
  assert.ok(n.content.includes('read_file'));
  assert.ok(n.issues.includes('empty output'));
});

// ---- workflow constraints ----

test('guards: checkWorkflow enforces required steps', () => {
  const r = guards.checkWorkflow([{ name: 'read_file' }], { required_steps: ['read_file', 'write_file'] });
  assert.equal(r.allowed, false);
  assert.ok(r.issues.includes('required step not run: write_file'));
});

test('guards: checkWorkflow enforces prerequisites', () => {
  const r = guards.checkWorkflow([{ name: 'write_file' }], { prerequisites: { write_file: ['read_file'] } });
  assert.equal(r.allowed, false);
  assert.ok(r.issues.some((i) => i.includes('requires prior read_file')));
});

test('guards: checkWorkflow passes when satisfied', () => {
  const r = guards.checkWorkflow(
    [{ name: 'read_file' }, { name: 'write_file' }],
    { required_steps: ['read_file', 'write_file'], prerequisites: { write_file: ['read_file'] } }
  );
  assert.equal(r.allowed, true);
});

// ---- MCP surface ----

test('guards: tools expose 3 tools', () => {
  const names = guards.tools().map((t) => t.name);
  assert.deepEqual(names, ['tool_guard_rescue', 'tool_guard_validate', 'tool_guard_workflow']);
});

test('guards: dispatch works for all tools', () => {
  assert.equal(guards.dispatch('tool_guard_rescue', { toolCall: { function: { name: 'x', arguments: '{}' } } }).ok, true);
  assert.equal(guards.dispatch('tool_guard_validate', { name: 'x', result: { ok: true, output: 'ok' } }).valid, true);
  assert.equal(guards.dispatch('tool_guard_workflow', { toolLog: [], workflow: null }).allowed, true);
});
