const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const backends = require('../src/backends');
const profiler = require('../src/profiler');
const { runAgent } = require('../src/agent/run');

test('v1018: built-in tools are recorded by the profiler', async () => {
  const original = backends.backendChat;
  let call = 0;
  backends.backendChat = async () => {
    call++;
    if (call === 1) {
      return {
        status: 200,
        data: {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call_time_1',
              type: 'function',
              function: { name: 'get_time', arguments: '{}' },
            }],
          },
          prompt_eval_count: 5,
          eval_count: 2,
        },
      };
    }
    return {
      status: 200,
      data: {
        message: { role: 'assistant', content: 'done' },
        prompt_eval_count: 3,
        eval_count: 2,
      },
    };
  };
  try {
    profiler.reset();
    profiler.startRun('v1018-test');
    const result = await runAgent({
      model: 'mock',
      messages: [{ role: 'user', content: 'what time is it?' }],
      autoApprove: true,
      onEvent: () => {},
    });
    assert.ok(result.final);
    const report = profiler.report();
    assert.equal(report.toolCalls, 1);
    assert.equal(report.uniqueTools, 1);
    assert.equal(report.tools[0].name, 'get_time');
  } finally {
    backends.backendChat = original;
    profiler.reset();
  }
});

test('v1018: OpenAI-compatible streaming requests include usage options', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'backends', 'index.js'), 'utf8');
  assert.match(src, /stream_options\s*=\s*\{\s*include_usage:\s*true\s*\}/);
  assert.match(src, /oaiBody\.stream\s*!==\s*false/);
});
