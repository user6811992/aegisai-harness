// src/python_client.js
// Embedded Python client: JSON-RPC over stdin/stdout to a python process.
const { spawn } = require('child_process');

function run(code, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const py = spawn(opts.python || 'python', ['-c', code], { cwd: opts.cwd || process.cwd(), encoding: 'utf8' });
    let stdout = '', stderr = '';
    py.stdout.on('data', (d) => { stdout += d; });
    py.stderr.on('data', (d) => { stderr += d; });
    py.on('close', (code) => resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() }));
    py.on('error', (e) => resolve({ ok: false, error: String(e.message || e) }));
  });
}
function evalExpr(expr, opts) { return run('print(' + expr + ')', opts); }

module.exports = { run, evalExpr };
