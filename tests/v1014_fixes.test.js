const { test } = require('node:test');
const assert = require('node:assert');

const backends = require('../src/backends');
const profiler = require('../src/profiler');
const { runAgent } = require('../src/agent/run');

test('v1014: agent run records profiler tokens without a TDZ error', async () => {
  const original = backends.backendChat;
  backends.backendChat = async () => ({
    status: 200,
    data: {
      message: { role: 'assistant', content: 'hi' },
      prompt_eval_count: 3,
      eval_count: 4,
    },
  });
  try {
    profiler.reset();
    const result = await runAgent({
      model: 'mock',
      messages: [{ role: 'user', content: 'hello' }],
      autoApprove: true,
      onEvent: () => {},
    });
    assert.equal(result.final.final, 'hi');
    const report = profiler.report();
    assert.equal(report.iterations, 1);
    assert.equal(report.tokens, 7);
  } finally {
    backends.backendChat = original;
    profiler.reset();
  }
});
