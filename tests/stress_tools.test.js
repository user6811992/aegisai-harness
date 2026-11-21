const test = require('node:test');
const assert = require('node:assert');
const registry = require('../src/tools/registry');

test('stress: assemble 1595 tools within budget', () => {
  const external = { mock: [] };
  for (let i = 0; i < 1595; i++) {
    external.mock.push({ name: 'tool_' + i, description: 'A mock tool number ' + i, inputSchema: { type: 'object', properties: { x: { type: 'string' } } } });
  }
  const tools = registry.assemble({ includeCoding: true, toolBudget: 64, externalTools: external });
  assert.ok(tools.length <= 64, 'budget enforced');
  // payload size estimate
  const payload = JSON.stringify(tools);
  console.log('assembled tools:', tools.length, 'payload bytes:', payload.length);
});
