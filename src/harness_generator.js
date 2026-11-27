// src/harness_generator.js
// Harness specification generator — reads a harness spec JSON and generates
// the module scaffold, tool definitions, and configuration files.
//
// Usage: node src/harness_generator.js <spec-file.json>
//       node src/harness_generator.js --template research
const fs = require('fs');
const path = require('path');

// === Default harness spec schema ===
const DEFAULT_SCHEMA = {
  metadata: { title: 'string', version: 'string', description: 'string' },
  agent: { name: 'string', description: 'string', model: 'string', temperature: 0.3, maxTokens: 1000, systemPrompt: 'string' },
  tools: [
    { name: 'string', description: 'string', parameters: { type: 'object', properties: [] }, returns: { type: 'object' } }
  ],
  session: { maxHistory: 50, memoryEnabled: true, memoryType: 'sqlite', autoBrief: true, goalTracking: true },
  safety: { sandboxEnabled: true, maxSteps: 50, approvedTools: [], deniedTools: [], admissionGate: true, policyFile: 'charter.md' },
  output: { markdown: true, codeHighlighting: true, thinkingBlocks: true, citations: true, format: 'markdown' }
};

function parseSpecFile(specPath) {
  let specContent;
  try {
    specContent = fs.readFileSync(specPath, 'utf8');
  } catch (e) {
    console.error('Could not read spec file: ' + specPath);
    return null;
  }
  try {
    return JSON.parse(specContent);
  } catch (e) {
    console.error('Could not parse spec file (not valid JSON): ' + specPath);
    return null;
  }
}

function generateScaffold(specPath, outputRoot) {
  const spec = parseSpecFile(specPath);
  if (!spec) return false;

  const specName = path.basename(specPath, path.extname(specPath));
  const outputDir = path.join(outputRoot || process.cwd(), 'generated', specName);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    console.error('Could not create output directory: ' + outputDir);
    return false;
  }

  if (Array.isArray(spec.tools) && spec.tools.length > 0) {
    const toolDefs = spec.tools.map((tool) => {
      const params = tool.parameters || { type: 'object', properties: [] };
      const returns = tool.returns || { type: 'object', properties: {} };
      return '// Tool: ' + tool.name + '\n// ' + (tool.description || '') +
        '\nmodule.exports.' + tool.name + ' = async (params) => {\n' +
        '  // Parameters: ' + JSON.stringify(params.properties || [], null, 2) + '\n' +
        '  // Returns template: ' + JSON.stringify(returns, null, 2) + '\n' +
        "  throw new Error('Implement " + tool.name + " tool');\n};\n";
    });
    fs.writeFileSync(path.join(outputDir, 'tools.js'), toolDefs.join('\n'));
  }

  const config = {
    metadata: spec.metadata || DEFAULT_SCHEMA.metadata,
    agent: spec.agent || DEFAULT_SCHEMA.agent,
    safety: spec.safety || { sandboxEnabled: true, maxSteps: 50 },
    output: spec.output || { markdown: true }
  };
  fs.writeFileSync(path.join(outputDir, 'config.json'), JSON.stringify(config, null, 2));

  const session = spec.session || DEFAULT_SCHEMA.session;
  fs.writeFileSync(path.join(outputDir, 'session-config.js'),
    '// Session configuration for ' + ((spec.agent && spec.agent.name) || 'unnamed-agent') + '\n' +
    'module.exports = {\n' +
    '  maxHistory: ' + (session.maxHistory || 50) + ',\n' +
    '  memoryEnabled: ' + (session.memoryEnabled !== false) + ',\n' +
    "  memoryType: '" + (session.memoryType || 'sqlite') + "'\n};\n");

  console.log('Harness scaffold generated at: ' + outputDir);
  return true;
}

function generateFromTemplate(templateName, outputRoot) {
  const templates = {
    research: {
      metadata: { title: 'Research Assistant', version: '1.0.0', description: 'Research assistant harness' },
      agent: { name: 'research-assistant', model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 1000, systemPrompt: 'You are a research assistant.' },
      tools: [
        { name: 'web_search', description: 'Search the web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, returns: { type: 'object' } },
        { name: 'memory_search', description: 'Search memory', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, returns: { type: 'object' } }
      ],
      session: { maxHistory: 50, memoryEnabled: true, memoryType: 'sqlite', autoBrief: true, goalTracking: true },
      safety: { sandboxEnabled: true, maxSteps: 50, approvedTools: ['web_search', 'memory_search'], deniedTools: [], admissionGate: true }
    }
  };
  const t = templates[templateName];
  if (!t) {
    console.error('Unknown template: ' + templateName + '. Available: ' + Object.keys(templates).join(', '));
    return false;
  }
  const specPath = path.join(outputRoot || process.cwd(), templateName + '-harness-spec.json');
  fs.writeFileSync(specPath, JSON.stringify(t, null, 2));
  console.log('Template spec written: ' + specPath);
  return generateScaffold(specPath, outputRoot);
}

function cli(argv) {
  const args = argv || process.argv.slice(2);
  if (args.includes('--template')) {
    const name = args[args.indexOf('--template') + 1];
    return generateFromTemplate(name) ? 0 : 1;
  }
  if (args.length > 0) return generateScaffold(args[0]) ? 0 : 1;
  console.log('Usage:');
  console.log('  node src/harness_generator.js <spec-file.json>');
  console.log('  node src/harness_generator.js --template research');
  return 0;
}

if (require.main === module) process.exitCode = cli();
module.exports = { generateScaffold, generateFromTemplate, DEFAULT_SCHEMA, cli };
