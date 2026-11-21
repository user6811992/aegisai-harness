// src/agent/run.js
const backends = require('../backends');
const coding = require('../tools/coding');
const registry = require('../tools/registry');
const compactMod = require('./compact');
const { OFFLINE: CONFIG_OFFLINE } = require('../core/config');

const DESTRUCTIVE = new Set(['write_file', 'delete_file', 'run_command', 'run_python']);

async function runAgent(opts) {
  opts = opts || {};
  const {
    model,
    messages,
    projectRoot = process.cwd(),
    includeCoding = true,
    cleanRoom = false,
    toolBudget = 64,
    allowedTools,
    deniedTools,
    onEvent = () => {},
    signal,
    externalTools = {},
    mcpTools = [],
    fallbackModels = [],
    maxHistory = 20,
    maxTokens = 0,
    compact = true,
    compactThreshold = 16,
    compactKeep = 8,
    tokenBudgetTotal = 0,
    approvalHandler = null,
    autoApprove = false,
    sandbox = false,
    offline = CONFIG_OFFLINE,
  } = opts;

  const toolLog = [];
  let msgs = [...(messages || [])];
  if (compact && msgs.length > compactThreshold) {
    msgs = await compactMod.compactMessages({ messages: msgs, model, keep: compactKeep, threshold: compactThreshold });
  } else if (maxHistory > 0 && msgs.length > maxHistory) {
    const systemMsgs = msgs.filter((m) => m.role === 'system');
    const others = msgs.filter((m) => m.role !== 'system');
    const kept = others.slice(-maxHistory);
    msgs = [...systemMsgs, ...kept];
  }

  // merge MCP tools into externalTools
  const mergedExternal = Object.assign({}, externalTools);
  const mcpLookup = new Map();
  for (const t of (mcpTools || [])) {
    const src = t.src || 'mcp';
    if (!mergedExternal[src]) mergedExternal[src] = [];
    mergedExternal[src].push(t);
    mcpLookup.set(`${src}_${t.name}`, t);
  }
  const tools = registry.assemble({ includeCoding, toolBudget, allowedTools, deniedTools, externalTools: mergedExternal, offline });

  let totalTokens = 0;
  let iterations = 0;
  const MAX_ITERS = 25;
  while (iterations < MAX_ITERS) {
    iterations += 1;
    onEvent({ type: 'status', message: 'calling model' });
    let resp;
    const modelsToTry = [model].concat(Array.isArray(fallbackModels) ? fallbackModels : []).filter(Boolean);
    let lastErr = null;
    for (let mi = 0; mi < modelsToTry.length; mi++) {
      const m = modelsToTry[mi];
      if (mi > 0) onEvent({ type: 'status', message: 'falling back to ' + m });
      try {
        resp = await backends.backendChat({ model: m, messages: msgs, tools, stream: true, maxTokens }, (e) => onEvent(e), signal);
        break;
      } catch (e) {
        if (tools && tools.length > 0) {
          try {
            resp = await backends.backendChat({ model: m, messages: msgs, tools: [], stream: true, maxTokens }, (e) => onEvent(e), signal);
            tools.length = 0;
            break;
          } catch (e2) {
            lastErr = e2;
            continue;
          }
        }
        lastErr = e;
        continue;
      }
    }
    if (!resp) {
      return { final: { type: 'done', final: 'error: ' + ((lastErr && (lastErr.message || lastErr)) || 'all models failed'), toolLog }, toolLog };
    }
    const data = resp && resp.data ? resp.data : resp;
    const msg = (data && data.message) || {};
    const toolCalls = msg.tool_calls;
    const thinking = msg.thinking || msg.reasoning_content || '';
    totalTokens += (data.prompt_eval_count || 0) + (data.eval_count || 0);

    if (!toolCalls || (Array.isArray(toolCalls) && toolCalls.length === 0)) {
      const finalText = msg.content || '';
      return { final: { type: 'done', final: finalText, thinking, toolLog, tokenStats: { prompt: data.prompt_eval_count || 0, generated: data.eval_count || 0, total: totalTokens } }, toolLog };
    }

    if (tokenBudgetTotal > 0 && totalTokens > tokenBudgetTotal) {
      return { final: { type: 'done', final: '(token budget exceeded)', toolLog, tokenStats: { total: totalTokens } }, toolLog };
    }

    msgs.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls });

    for (const tc of toolCalls) {
      const fn = tc.function || tc;
      const name = fn.name;
      let args = fn.arguments;
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
      args = args || {};

      if (cleanRoom && registry.isCleanRoomBlocked(name)) {
        const blocked = 'BLOCKED (clean room): ' + name;
        toolLog.push({ name, resultPreview: blocked });
        onEvent({ type: 'tool_result', name, preview: blocked });
        msgs.push({ role: 'tool', content: blocked, name });
        continue;
      }

      // approval gate for destructive tools
      if (DESTRUCTIVE.has(name) && !autoApprove) {
        let approved = true;
        if (typeof approvalHandler === 'function') {
          try { approved = await approvalHandler(name, args); } catch (e) { approved = false; }
        } else {
          approved = false;
        }
        if (!approved) {
          const denied = 'BLOCKED (approval denied): ' + name;
          toolLog.push({ name, resultPreview: denied });
          onEvent({ type: 'approval_denied', name });
          msgs.push({ role: 'tool', content: denied, name });
          continue;
        }
      }

      onEvent({ type: 'tool_call', name, args });
      let result;
      try {
        if (mcpLookup.has(name)) {
          const t = mcpLookup.get(name);
          try {
            const r = await t.client.callTool(t.remoteName || t.name, args);
            const content = (r && r.content) ? r.content.map((c) => c.text || JSON.stringify(c)).join('\n') : JSON.stringify(r);
            result = { ok: !(r && r.isError), output: String(content).slice(0, 4000) };
          } catch (e) {
            result = { ok: false, output: String(e.message || e) };
          }
        } else if (name.startsWith('rea_') || name.startsWith('ghidra_') || name.startsWith('craft_') || name.startsWith('are_')) {
          result = { ok: true, output: 'external tool not wired: ' + name };
        } else {
          result = await coding.execCodingTool(name, args, projectRoot, { sandbox, offline });
        }
      } catch (e) {
        result = { ok: false, output: String(e.message || e) };
      }
      const preview = (result && (result.output || result.out)) || '';
      const previewStr = String(preview).slice(0, 500);
      toolLog.push({ name, resultPreview: previewStr });
      onEvent({ type: 'tool_result', name, preview: previewStr });
      msgs.push({ role: 'tool', content: previewStr, name });
    }
  }

  onEvent({ type: 'done', final: '(max iterations reached)', toolLog });
  return { final: { type: 'done', final: '(max iterations reached)', toolLog, tokenStats: { total: totalTokens } }, toolLog };
}

module.exports = { runAgent };
