// src/agent/run.js
const backends = require('../backends');
const coding = require('../tools/coding');
const registry = require('../tools/registry');
const compactMod = require('./compact');
const hooks = require('../hooks');
const { Tracer } = require('../tracing');
const { DoomLoopDetector, fingerprint } = require('../doomloop');
const stopConditions = require('../stopconditions');
const asyncTools = require('../async_tools');
const { OFFLINE: CONFIG_OFFLINE } = require('../core/config');
const dbModule = require('../storage/db');

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
    trace = false,
    doomLoop = false,
    stopWhen = null,
    stateAccessor = null,
    toolContext = null,
    sharedContext = null,
    backgroundTools = [],
  } = opts;

  const toolLog = [];
  let msgs = [...(messages || [])];
  if (stateAccessor && typeof stateAccessor.load === 'function') {
    try {
      const st = await stateAccessor.load();
      if (st && Array.isArray(st.messages)) msgs = [...st.messages, ...msgs];
    } catch (e) {}
  }
  const archive = [];
  const tracer = trace ? new Tracer() : null;
  const detector = doomLoop ? new DoomLoopDetector(typeof doomLoop === 'object' ? doomLoop : {}) : null;
  const bgPool = new asyncTools.BackgroundPool();
  let stepCount = 0;
  const allToolCalls = [];
  if (compact && msgs.length > compactThreshold) {
    const res = await compactMod.compactMessages({ messages: msgs, model, keep: compactKeep, threshold: compactThreshold });
    msgs = res.messages;
    archive.push(...(res.archived || []));
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
  if (archive.length > 0) {
    tools.push({ type: 'function', function: { name: 'recall_archived_context', description: 'Search compacted/archived conversation context by keyword.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } });
  }
  // codebase search tool if index available
  try {
    const ci = require('../indexing/codeindex');
    ci.ensureSchema(dbModule.get());
    tools.push({ type: 'function', function: { name: 'search_codebase', description: 'Search indexed codebase symbols by name/path.', parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } } });
  } catch (e) {}
  tools.push({ type: 'function', function: { name: 'delegate_to_agent', description: 'Delegate a task to a named sub-agent (default, coder, researcher, clean-room).', parameters: { type: 'object', properties: { agent: { type: 'string' }, task: { type: 'string' }, model: { type: 'string' }, maxTokens: { type: 'number' } }, required: ['task'] } } });
  tools.push(asyncTools.TASK_TOOL_DEF);

  let totalTokens = 0;
  let iterations = 0;
  const MAX_ITERS = 25;
  while (iterations < MAX_ITERS) {
    // stop conditions
    if (stopWhen) {
      const ctx = { stepCount, totalTokens, totalCost: 0, toolCalls: allToolCalls };
      if (stopConditions.evaluate(stopWhen, ctx)) {
        // final turn without tools
        try {
          const r = await backends.backendChat({ model, messages: msgs, tools: [], stream: true, maxTokens }, (e) => onEvent(e), signal);
          const d = r && r.data ? r.data : r;
          const m = (d && d.message) || {};
          if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
          return { final: { type: 'done', final: m.content || '', toolLog, tokenStats: { total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
        } catch (e) {}
        if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
        return { final: { type: 'done', final: '(stopped)', toolLog, tokenStats: { total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
      }
    }
    iterations += 1;
    onEvent({ type: 'status', message: 'calling model' });
    const iterSpan = tracer ? tracer.startSpan('iteration', { iteration: iterations }) : null;
    if (iterations === 1) await hooks.run('SessionStart', { hasTools: tools.length > 0, hasApproval: !!approvalHandler });
    await hooks.run('beforeModel', { messages: msgs, tools, iteration: iterations });
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
      if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
      return { final: { type: 'done', final: 'error: ' + ((lastErr && (lastErr.message || lastErr)) || 'all models failed'), toolLog, trace: tracer ? tracer.toJSON() : null }, toolLog };
    }
    await hooks.run('afterModel', { response: resp, iteration: iterations });
    const data = resp && resp.data ? resp.data : resp;
    await hooks.run('PostModelCall', { responseId: (data && data.id) || null, model, durationMs: 0, turnType: iterations === 1 ? 'initial' : 'tool_round', turnNumber: iterations, usage: { inputTokens: data.prompt_eval_count || 0, outputTokens: data.eval_count || 0 } });
    const msg = (data && data.message) || {};
    const toolCalls = msg.tool_calls;
    const thinking = msg.thinking || msg.reasoning_content || '';
    totalTokens += (data.prompt_eval_count || 0) + (data.eval_count || 0);
    if (iterSpan) tracer.endSpan(iterSpan, { tokens: data.eval_count || 0 });

    if (!toolCalls || (Array.isArray(toolCalls) && toolCalls.length === 0)) {
      const finalText = msg.content || '';
      if (stateAccessor && typeof stateAccessor.save === 'function') { try { await stateAccessor.save({ messages: msgs, toolLog, totalTokens }); } catch (e) {} }
      await hooks.run('SessionEnd', { reason: 'complete', totalUsage: { totalTokens } });
      if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
      return { final: { type: 'done', final: finalText, thinking, toolLog, tokenStats: { prompt: data.prompt_eval_count || 0, generated: data.eval_count || 0, total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
    }

    if (tokenBudgetTotal > 0 && totalTokens > tokenBudgetTotal) {
      if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
      return { final: { type: 'done', final: '(token budget exceeded)', toolLog, tokenStats: { total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
    }

    msgs.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls });

    // parallel tool execution
    const results = await Promise.all(toolCalls.map(async (tc) => {
      const fn = tc.function || tc;
      const name = fn.name;
      let args = fn.arguments;
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
      args = args || {};

      if (cleanRoom && registry.isCleanRoomBlocked(name)) {
        const blocked = 'BLOCKED (clean room): ' + name;
        return { name, args, blocked };
      }
      if (DESTRUCTIVE.has(name) && !autoApprove) {
        // PermissionRequest hook
        const pr = await hooks.run('PermissionRequest', { toolName: name, toolInput: args, riskLevel: 'high' });
        let approved;
        if (pr && pr.decision === 'allow') approved = true;
        else if (pr && pr.decision === 'deny') approved = false;
        else {
          approved = true;
          if (typeof approvalHandler === 'function') {
            try { approved = await approvalHandler(name, args); } catch (e) { approved = false; }
          } else {
            approved = false;
          }
        }
        if (!approved) {
          return { name, args, denied: true };
        }
      }
      const toolSpan = tracer ? tracer.startSpan('tool:' + name, { name }) : null;
      const hr = await hooks.run('beforeTool', { toolName: name, toolInput: args, args });
      if (hr && hr.blocked) {
        const blocked = 'BLOCKED (hook): ' + (hr.reason || name);
        return { name, args, hookBlocked: blocked };
      }
      if (hr && hr.mutatedArgs) args = hr.mutatedArgs;
      else if (hr && hr.finalArgs) args = hr.finalArgs;
      onEvent({ type: 'tool_call', name, args });
      let result;
      try {
        if (name === 'task') {
          result = asyncTools.handleTask(bgPool, args);
        } else if (Array.isArray(backgroundTools) && backgroundTools.includes(name)) {
          const r = await bgPool.run(name, async (log) => coding.execCodingTool(name, args, projectRoot, { sandbox, offline }), 250);
          if (r.pending) {
            result = { ok: true, output: JSON.stringify({ pending: true, taskId: r.taskId, message: 'background task started' }) };
          } else {
            result = r.result || { ok: true, output: JSON.stringify(r.result) };
          }
        } else if (name === 'search_codebase') {
          try {
            const ci = require('../indexing/codeindex');
            ci.ensureSchema(dbModule.get());
            const rows = ci.searchIndex(dbModule.get(), args.query || '', args.limit || 20);
            result = { ok: true, output: rows.map((r) => `${r.path}:${r.line} ${r.kind} ${r.symbol}`).join('\n') || '(no matches)' };
          } catch (e) {
            result = { ok: false, output: String(e.message || e) };
          }
        } else if (name === 'delegate_to_agent') {
          const profilesMod = require('../agents/profiles');
          const subProfile = profilesMod.getProfile(args.agent || 'default');
          const subRes = await runAgent({
            model: args.model || subProfile.model || model,
            messages: [{ role: 'system', content: subProfile.systemPrompt }, { role: 'user', content: args.task || '' }],
            projectRoot,
            includeCoding: subProfile.includeCoding !== false,
            cleanRoom: subProfile.cleanRoom,
            allowedTools: subProfile.allowedTools,
            deniedTools: subProfile.deniedTools,
            sandbox: subProfile.sandbox,
            autoApprove: true,
            maxTokens: args.maxTokens || 0,
          });
          result = { ok: true, output: (subRes.final && subRes.final.final) || '' };
        } else if (name === 'recall_archived_context') {
          const q = (args.query || '').toLowerCase();
          const hits = archive.filter((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).toLowerCase().includes(q));
          const out = hits.map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n---\n');
          result = { ok: true, output: out || '(no archived matches)' };
        } else if (mcpLookup.has(name)) {
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
          result = await coding.execCodingTool(name, args, projectRoot, { sandbox, offline, toolContext, sharedContext });
        }
      } catch (e) {
        result = { ok: false, output: String(e.message || e) };
      }
      await hooks.run('afterTool', { name, args, result });
      if (toolSpan) {
        if (result && result.ok === false) tracer.failSpan(toolSpan, result.output);
        else tracer.endSpan(toolSpan);
      }
      return { name, args, result };
    }));

    for (const r of results) {
      if (r.hookBlocked) {
        const preview = r.hookBlocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.blocked) {
        const preview = r.blocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.denied) {
        const denied = 'BLOCKED (approval denied): ' + r.name;
        toolLog.push({ name: r.name, args: r.args, resultPreview: denied });
        onEvent({ type: 'approval_denied', name: r.name });
        msgs.push({ role: 'tool', content: denied, name: r.name });
        continue;
      }
      const preview = (r.result && (r.result.output || r.result.out)) || '';
      const previewStr = String(preview).slice(0, 500);
      toolLog.push({ name: r.name, args: r.args, resultPreview: previewStr });
      onEvent({ type: 'tool_result', name: r.name, preview: previewStr });
      msgs.push({ role: 'tool', content: previewStr, name: r.name });
    }
    // doom-loop detection
    if (detector) {
      const roundFps = toolCalls.map((tc) => {
        const fn = tc.function || tc;
        let a = fn.arguments;
        if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } }
        return fingerprint(fn.name, a || {});
      });
      const verdicts = detector.record(roundFps);
      stepCount += 1;
      allToolCalls.push(...toolCalls.map((tc) => (tc.function || tc).name));
      const stopVerdict = verdicts.find((v) => v.action === 'stop');
      if (stopVerdict) {
        if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
        return { final: { type: 'done', final: '(doom loop stopped)', toolLog, tokenStats: { total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
      }
      if (verdicts.some((v) => v.action === 'block')) {
        msgs.push({ role: 'system', content: 'Doom loop detected: repeated identical tool calls. Change your approach.' });
      }
      if (verdicts.some((v) => v.action === 'observe')) {
        onEvent({ type: 'status', message: 'doom loop observed' });
      }
    } else {
      stepCount += 1;
      allToolCalls.push(...toolCalls.map((tc) => (tc.function || tc).name));
    }
  }

  if (tracer) { try { tracer.persist(dbModule.get()); tracer.exportOtel(); } catch (e) {} }
  onEvent({ type: 'done', final: '(max iterations reached)', toolLog });
  return { final: { type: 'done', final: '(max iterations reached)', toolLog, tokenStats: { total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
}

module.exports = { runAgent };
