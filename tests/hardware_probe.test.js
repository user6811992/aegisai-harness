const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const hp = require('../src/hardware_probe');

test('hardware_probe: parses vulkaninfo summary', () => {
  const text = `GPU0:
        apiVersion         = 1.4.315
        vendorID           = 0x1002
        deviceName         = AMD Radeon RX 5700 XT
        driverID           = DRIVER_ID_AMD_PROPRIETARY
        driverInfo         = 26.11.2 (AMD proprietary shader compiler)
`;
  const d = hp.parseVulkan(text);
  assert.equal(d.length, 1);
  assert.equal(d[0].deviceName, 'AMD Radeon RX 5700 XT');
  assert.equal(d[0].vendorID, '0x1002');
});

test('hardware_probe: live probe returns structured capability', () => {
  const p = hp.probe({ timeoutMs: 8000 });
  assert.equal(p.ok, true);
  assert.ok(p.platform);
  assert.equal(typeof p.vulkan.available, 'boolean');
  assert.equal(typeof p.cuda.available, 'boolean');
  assert.equal(typeof p.metal, 'boolean');
  // The probe never mutates state or requires network.
  assert.ok(Array.isArray(p.notes));
});

test('hardware_probe: recommends from capability profile', () => {
  const r = hp.recommend({ vulkan: { available: true }, cuda: { available: false }, metal: false });
  assert.deepEqual(r.backends, ['vulkan']);
  assert.deepEqual(hp.recommend({ vulkan: { available: false }, cuda: { available: false }, metal: false }).backends, ['cpu']);
});

test('hardware_probe: MCP tool registered', () => {
  const mcp = fs.readFileSync(path.join(__dirname, '..', 'src', 'mcp_server.js'), 'utf8');
  assert.ok(mcp.includes('./hardware_probe'));
  assert.ok(hp.tools().some((t) => t.name === 'hardware_probe'));
});
