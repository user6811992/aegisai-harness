const test = require('node:test');
const assert = require('node:assert');

test('core modules load', () => {
  require('../src/core/config');
  require('../src/core/security');
  require('../src/core/capabilities');
  require('../src/core/logger');
  assert.ok(true);
});

test('safePath blocks traversal', () => {
  const { safePath } = require('../src/core/security');
  const root = 'C:\\tmp\\proj';
  assert.throws(() => safePath(root, '../etc/passwd'));
});

test('capabilities filter', () => {
  const { filterTools } = require('../src/core/capabilities');
  const tools = [
    { function: { name: 'read_file' } },
    { function: { name: 'write_file' } },
  ];
  const out = filterTools(tools, { deniedTools: ['write_file'] });
  assert.equal(out.length, 1);
  assert.equal(out[0].function.name, 'read_file');
});

test('registry assembles tools', () => {
  const registry = require('../src/tools/registry');
  const tools = registry.assemble({ includeCoding: true, toolBudget: 10 });
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length > 0);
});
