// src/task_board.js
// Parallel task board: ephemeral worktrees + dependency chains + auto-start on completion.
const db = require('./storage/db');
const { spawnSync } = require('child_process');
const path = require('path');

function add(title, prompt, deps) {
  const id = 'bt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const task = { id, title, prompt: prompt || title, deps: deps || [], status: 'todo', worktree: null, created: new Date().toISOString() };
  save(task);
  return task;
}
function save(t) {
  try { db.get().prepare('INSERT OR REPLACE INTO board_tasks (id, created, data) VALUES (?,?,?)').run(t.id, t.created, JSON.stringify(t)); } catch (e) {}
}
function get(id) {
  try { const r = db.get().prepare('SELECT * FROM board_tasks WHERE id = ?').get(id); return r ? JSON.parse(r.data || '{}') : null; } catch (e) { return null; }
}
function list() {
  try { return db.get().prepare('SELECT data FROM board_tasks ORDER BY created DESC').all().map((r) => JSON.parse(r.data || '{}')); } catch (e) { return []; }
}
function ready(tasks) {
  return tasks.filter((t) => t.status === 'todo' && (t.deps || []).every((d) => { const dep = get(d); return dep && dep.status === 'done'; }));
}
function createWorktree(taskId, repoRoot) {
  const t = get(taskId);
  if (!t) return null;
  const dir = path.join(repoRoot || process.cwd(), '.harness-worktrees', taskId);
  try {
    const r = spawnSync('git', ['worktree', 'add', '-b', 'hw-' + taskId, dir], { cwd: repoRoot || process.cwd(), encoding: 'utf8', timeout: 10000 });
    if (r.status === 0) { t.worktree = dir; t.status = 'running'; save(t); return dir; }
  } catch (e) {}
  t.status = 'running'; save(t);
  return null;
}
function complete(taskId) {
  const t = get(taskId);
  if (!t) return { ok: false };
  t.status = 'done'; save(t);
  const started = [];
  for (const other of list()) {
    if (other.status === 'todo' && (other.deps || []).includes(taskId) && (other.deps || []).every((d) => { const dep = get(d); return dep && dep.status === 'done'; })) {
      other.status = 'ready'; save(other); started.push(other.id);
    }
  }
  return { ok: true, unblocked: started };
}

module.exports = { add, get, list, ready, createWorktree, complete };
