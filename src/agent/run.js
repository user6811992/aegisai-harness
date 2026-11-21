// src/agent/run.js
// Agent tool-call loop. Returns { final, toolLog }.
const backends = require('../backends');
const coding = require('../tools/coding');
const registry = require('../tools/registry');

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
    fallbackModels = [],
    maxHistory = 20,
    maxTokens = 0,
  } = opts;

  const toolLog = [];
  const msgs = [...(messages || [])];
  if (maxHistory > 0 && msgs.length > maxHistory) {
    const systemMsgs = msgs.filter((m) => m.role === 'system');
    const others = msgs.filter((m) => m.role !== 'system');
    const kept = others.slice(-maxHistory);
    msgs.length = 0;
    msgs.push(...systemMsgs, ...kept);
  }

  const tools = registry.assemble({ includeCoding, toolBudget, allowedTools, deniedTools, externalTools });

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
            // remove tools for rest of run
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

    if (!toolCalls || (Array.isArray(toolCalls) && toolCalls.length === 0)) {
      const finalText = msg.content || '';
      return { final: { type: 'done', final: finalText, thinking, toolLog, tokenStats: { prompt: data.prompt_eval_count || 0, generated: data.eval_count || 0 } }, toolLog };
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

      onEvent({ type: 'tool_call', name, args });
      let result;
      try {
        if (name.startsWith('rea_') || name.startsWith('ghidra_') || name.startsWith('craft_') || name.startsWith('are_') || name.startsWith('mcp_')) {
          // external tool dispatch placeholder
          result = { ok: true, output: 'external tool not wired: ' + name };
        } else {
          result = await coding.execCodingTool(name, args, projectRoot);
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
  return { final: { type: 'done', final: '(max iterations reached)', toolLog }, toolLog };
}

module.exports = { runAgent };
