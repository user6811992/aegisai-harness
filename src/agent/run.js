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
const path = require('path');

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
    approvalMode = null,
    sandbox = false,
    offline = CONFIG_OFFLINE,
    trace = false,
    doomLoop = false,
    stopWhen = null,
    stateAccessor = null,
    toolContext = null,
    sharedContext = null,
    backgroundTools = [],
    policy = null,
    currentRing = 1,
    guardrails = null,
    progressiveTools = 0,
    toolOutputCompression = 0,
    verifyWork = false,
    planMode = false,
    browserTools = false,
    contextFiles = false,
    readOnly = false,
    piiProtection = false,
    charter = null,
    actionGuard = false,
    capsuleSession = null,
    agentCompact = false,
    rollback = false,
    debuggerInstance = null,
    lenientTools = false,
  } = opts;

  // project root allowlist
  const allowlist = (process.env.AEGISAI_PROJECT_ROOT_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.some((r) => projectRoot === r || projectRoot.startsWith(r + path.sep))) {
    return { final: { type: 'done', final: '(blocked: project root not allowlisted)', toolLog: [] }, toolLog: [] };
  }

  const runStart = Date.now();
  let totalTokensRef = 0;
  const capture = (finalText) => { try { require('../observability').captureRun({ model, prompt: (messages || []).map((m) => (typeof m.content === 'string' ? m.content : '')).join(' ').slice(0, 500), final: finalText || '', toolLog, tokenStats: { total: totalTokensRef }, durationMs: Date.now() - runStart }); } catch (e) {} };
  const effectiveAuto = (name) => {
    if (approvalMode === 'full-auto') return true;
    if (approvalMode === 'auto-edit') return !DESTRUCTIVE.has(name);
    if (approvalMode === 'suggest') return false;
    return !!autoApprove;
  };
  const toolLog = [];
  let msgs = [...(messages || [])];
  if (capsuleSession) {
    const cap = require('../capsule').latest(capsuleSession);
    if (cap && Array.isArray(cap.messages)) msgs = cap.messages.filter((m) => m.role === 'system').concat(msgs);
  }
  if (piiProtection) {
    const pii = require('../pii');
    msgs = msgs.map((m) => {
      if (typeof m.content !== 'string') return m;
      const r = pii.redact(m.content);
      return r.changed ? Object.assign({}, m, { content: r.text }) : m;
    });
  }
  if (contextFiles) msgs = require('../context_files').inject(msgs, projectRoot);
  const charterObj = charter === true ? require('../charter').load(projectRoot) : charter;
  if (guardrails && guardrails.input) {
    const gr = require('../guardrails');
    for (const m of msgs) {
      if (m.role !== 'user') continue;
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
      const check = gr.checkInput(text);
      if (!check.safe) {
        return { final: { type: 'done', final: '(blocked by input guardrail: ' + check.hits.join(', ') + ')', toolLog: [] }, toolLog: [] };
      }
    }
  }
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
  let tools = registry.assemble({ includeCoding, toolBudget, allowedTools, deniedTools, externalTools: mergedExternal, offline });
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
  tools.push({ type: 'function', function: { name: 'get_repo_map', description: 'Return a compact repo map: files, symbols, imports.', parameters: { type: 'object', properties: { maxFiles: { type: 'number' } } } } });
  tools.push({ type: 'function', function: { name: 'handoff_to_agent', description: 'Hand off task with full conversation context to a named agent.', parameters: { type: 'object', properties: { agent: { type: 'string' }, instruction: { type: 'string' } }, required: ['instruction'] } } });
  tools.push({ type: 'function', function: { name: 'sequential_thinking', description: 'Structured reflective thinking: record a thought, decide if more thoughts needed.', parameters: { type: 'object', properties: { thought: { type: 'string' }, thoughtNumber: { type: 'number' }, totalThoughts: { type: 'number' }, nextThoughtNeeded: { type: 'boolean' }, isRevision: { type: 'boolean' }, branchId: { type: 'string' } } } } });
  tools.push({ type: 'function', function: { name: 'fetch_url', description: 'Fetch a URL and return its content as Markdown.', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } });
  tools.push({ type: 'function', function: { name: 'get_time', description: 'Current time in a timezone.', parameters: { type: 'object', properties: { timezone: { type: 'string' } } } } });

  if (progressiveTools > 0) {
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    const q = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const core = new Set(['task', 'get_repo_map', 'handoff_to_agent', 'search_codebase', 'recall_archived_context']);
    const discovered = require('../tool_discovery').discover(tools, q, progressiveTools);
    const selected = discovered.filter((t) => core.has((t.function || t).name));
    tools = selected.length ? selected : discovered;
  }
  if (browserTools) tools.push(...require('../integrations/browser').TOOLS);
  if (planMode) tools = [];

  let totalTokens = 0;
  let iterations = 0;
  const MAX_ITERS = 25;
  while (iterations < MAX_ITERS) {
    // agent-decided / threshold compaction into a capsule
    if (agentCompact && iterations > 1 && require('../capsule').shouldCompact(msgs, typeof agentCompact === 'number' ? agentCompact : 0.8)) {
      require('../capsule').write(capsuleSession || 'default', msgs, { reason: 'auto-compact', iteration: iterations });
      const system = msgs.filter((m) => m.role === 'system');
      msgs = system.concat(msgs.slice(-6));
      archive.push(...(system.length ? [] : []));
    }
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
    let toolCalls = msg.tool_calls;
    const thinking = msg.thinking || msg.reasoning_content || '';
    totalTokens += (data.prompt_eval_count || 0) + (data.eval_count || 0);
    totalTokensRef = totalTokens;
    if (iterSpan) tracer.endSpan(iterSpan, { tokens: data.eval_count || 0 });

    if ((!toolCalls || (Array.isArray(toolCalls) && toolCalls.length === 0)) && lenientTools) {
      const parsed = require('../lenient_parse').parse(msg.content || '');
      if (parsed.length) toolCalls = parsed.map((c, i) => ({ id: 'lenient_' + i, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments || {}) } }));
    }
    if (!toolCalls || (Array.isArray(toolCalls) && toolCalls.length === 0)) {
      let finalText = msg.content || '';
      if (verifyWork) {
        const vr = require('../verifier').verify(finalText, toolLog);
        finalText += '\n\n[verification] ' + (vr.verified ? 'verified' : 'UNVERIFIED: ' + vr.issues.join('; '));
      }
      if (guardrails && guardrails.output) {
        const gr = require('../guardrails');
        const check = gr.checkOutput(finalText, guardrails.output === true ? {} : guardrails.output);
        if (!check.safe) finalText = '(blocked by output guardrail: ' + check.hits.join(', ') + ')';
      }
      if (stateAccessor && typeof stateAccessor.save === 'function') { try { await stateAccessor.save({ messages: msgs, toolLog, totalTokens }); } catch (e) {} }
      capture(finalText);
      if (capsuleSession) { try { require('../capsule').write(capsuleSession, msgs, { reason: 'complete', final: String(finalText).slice(0, 200) }); } catch (e) {} }
      try { require('../ledger').append('run_complete', { model, prompt: String((messages || [])[0]?.content || '').slice(0, 200), final: String(finalText).slice(0, 500), tools: toolLog.length }); } catch (e) {}
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

      // governance charter
      if (charterObj) {
        const ce = require('../charter').enforce(charterObj, name, args);
        if (!ce.allowed) return { name, args, charterBlocked: ce.reason };
        if (ce.approval && !effectiveAuto(name)) return { name, args, denied: true };
      }
      // debugger breakpoint / step
      if (debuggerInstance) {
        debuggerInstance.onEvent({ type: 'tool_call', name, args });
        if (debuggerInstance.shouldPause(name)) {
          onEvent({ type: 'debug_pause', name, args });
          return { name, args, debugPaused: true };
        }
      }
      // evidence-based action guardrails
      if (actionGuard) {
        const ag = require('../action_guard').gate(name, args, { toolLog });
        if (!ag.allowed) return { name, args, actionBlocked: ag.rule + ': ' + ag.reason };
      }
      // read-only boundary
      const ro = require('../read_only').enforce(name, readOnly);
      if (!ro.allowed) return { name, args, readOnlyBlocked: ro.reason };
      // policy engine check
      if (policy) {
        const pol = require('../policy');
        const verdict = pol.evaluate(policy, { tool_name: name, args });
        if (!verdict.allowed) {
          const blocked = 'BLOCKED (policy): ' + (verdict.rule || name);
          return { name, args, policyBlocked: blocked };
        }
      }
      // sandbox ring check
      const rings = require('../sandbox_rings');
      const toolRing = rings.ringOf(name);
      if (!rings.allowed(currentRing, toolRing)) {
        const blocked = 'BLOCKED (ring): ' + name + ' requires ring ' + rings.describe(toolRing);
        return { name, args, ringBlocked: blocked };
      }
      if (cleanRoom && registry.isCleanRoomBlocked(name)) {
        const blocked = 'BLOCKED (clean room): ' + name;
        return { name, args, blocked };
      }
      if (DESTRUCTIVE.has(name) && !effectiveAuto(name)) {
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
        if (name === 'sequential_thinking') {
          result = require('../sequential_thinking').think(args.thought, args.nextThoughtNeeded, args.thoughtNumber, args.totalThoughts, args.isRevision, null, null, args.branchId);
        } else if (name === 'fetch_url') {
          result = await require('../fetch_url').fetch(args.url);
        } else if (name === 'get_time') {
          result = require('../time_tool').now(args.timezone);
        } else if (name === 'task') {
          result = asyncTools.handleTask(bgPool, args);
        } else if (name.startsWith('browser_')) {
          result = await require('../integrations/browser').handle(name, args);
        } else if (name === 'get_repo_map') {
          try {
            const ci = require('../indexing/codeindex');
            const map = ci.buildRepoMap(projectRoot, args.maxFiles || 100);
            result = { ok: true, output: map.map((f) => f.path + ': ' + f.symbols.join(', ')).join('\n').slice(0, 4000) };
          } catch (e) { result = { ok: false, output: String(e.message || e) }; }
        } else if (name === 'handoff_to_agent') {
          const profilesMod = require('../agents/profiles');
          const subProfile = profilesMod.getProfile(args.agent || 'default');
          const subMsgs = msgs.filter((m) => m.role !== 'tool').concat([{ role: 'user', content: args.instruction || '' }]);
          const subRes = await runAgent({ model: subProfile.model || model, messages: subMsgs, projectRoot, includeCoding: subProfile.includeCoding !== false, cleanRoom: subProfile.cleanRoom, allowedTools: subProfile.allowedTools, deniedTools: subProfile.deniedTools, sandbox: subProfile.sandbox, autoApprove: true });
          result = { ok: true, output: (subRes.final && subRes.final.final) || '' };
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
          const prefix = name.slice(0, name.indexOf('_') + 1);
          result = require('../integrations/retools').runTool(prefix, name, args);
        } else {
          if (rollback && (name === 'write_file' || name === 'delete_file')) {
            try { const rbId = require('../rollback').snapshotFile(args.path, projectRoot); toolLog.push({ name: '__rollback__', args: { path: args.path }, resultPreview: rbId }); } catch (e) {}
          }
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
      if (r.debugPaused) {
        const preview = 'PAUSED (debugger): ' + r.name;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.actionBlocked) {
        const preview = r.actionBlocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.charterBlocked) {
        const preview = r.charterBlocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.readOnlyBlocked) {
        const preview = r.readOnlyBlocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.policyBlocked) {
        const preview = r.policyBlocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
      if (r.ringBlocked) {
        const preview = r.ringBlocked;
        toolLog.push({ name: r.name, args: r.args, resultPreview: preview });
        onEvent({ type: 'tool_result', name: r.name, preview });
        msgs.push({ role: 'tool', content: preview, name: r.name });
        continue;
      }
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
      let previewStr = String(preview).slice(0, 500);
      if (toolOutputCompression > 0) previewStr = require('../output_compress').compress(String(preview), toolOutputCompression);
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
  capture('(max iterations reached)');
  return { final: { type: 'done', final: '(max iterations reached)', toolLog, tokenStats: { total: totalTokens }, trace: tracer ? tracer.toJSON() : null }, toolLog };
}

module.exports = { runAgent };
