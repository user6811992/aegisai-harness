// src/tool_contract.js
// Tool contract export: make internal tools discoverable/runnable/skill-exportable.
function exportContract(tools) {
  return (tools || []).map((t) => {
    const f = t.function || t;
    return {
      name: f.name,
      description: f.description || '',
      inputSchema: f.parameters || { type: 'object', properties: {} },
      discoverable: true, runnable: true, skillExportable: true,
      contractVersion: '1.0',
    };
  });
}
function toSkill(tool) {
  const f = tool.function || tool;
  return '---\nname: ' + f.name + '\ndescription: ' + (f.description || '') + '\n---\n\n# ' + f.name + '\n\nInvoke the ' + f.name + ' tool with the declared input schema.\n';
}

module.exports = { exportContract, toSkill };
