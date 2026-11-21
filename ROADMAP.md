# Roadmap — AegisAi Harness

Tracked milestones. Checkboxes are the source of truth; update as work lands.

## v0.1 — Scaffold (done)
- [x] Create private repo `aegisai-harness`
- [x] Initial project scaffold (package.json, .gitignore, README, ROADMAP)
- [x] Core modules: config, logger, security, capabilities
- [x] Backend adapter (Ollama + OpenAI-compat) with streaming
- [x] Agent loop (tool calls, fallback, budget, clean-room)
- [x] Tool registry + coding tools (file ops, shell, python, search)
- [x] SQLite persistence (sessions, memories)
- [x] Basic CLI entry point
- [x] Smoke test: run agent against local Ollama

## v0.2 — Safety & context (P0)
- [x] Sandboxed tool execution (process isolation for run_command; no shell in sandbox mode)
- [x] Human-in-the-loop approval gates for destructive tools (approvalHandler + --auto-approve)
- [x] MCP client (stdio transport: initialize, tools/list, tools/call)
- [x] Context compaction (summarize older messages; replaces last-N truncation)
- [x] Token budgeting & accounting per run (tokenBudgetTotal + total stats)
- [x] Offline mode toggle (removes network tools; --offline flag)
- [x] HTTP MCP transport + reconnect
- [x] Retrievable archive / expand-on-demand (recall_archived_context tool)

## v0.3 — Capability (P1)
- [x] Named agents/profiles (prompt + tools + permissions + model) — src/agents/profiles.js
- [x] Subagents / delegation + parallel tool calls — delegate_to_agent + Promise.all
- [x] Deterministic replay from stored transcript — src/replay.js
- [x] Code/repo indexing (symbol extraction + search_codebase tool)
- [x] Hooks/transforms around model & tool calls — src/hooks.js
- [x] Signed plugins with declared permissions — src/core/plugins.js
- [x] CLI/TUI for headless operation — REPL + --agent flag

## v0.4 — Quality & polish (P2) (done)
- [x] Tracing (per-iteration, per-tool timing, errors) — src/tracing.js + /traces
- [x] Agent eval harness with rubrics — src/eval.js + /eval
- [x] Backend resilience (retries, circuit breakers, health checks) — backends/index.js
- [x] Encrypted local secret vault — src/vault.js + /vault
- [x] Full-state backup/restore — src/backup.js + /backup /restore
- [ ] Desktop packaging + offline auto-update (deferred — CLI only)
- [ ] Accessibility & theming (N/A for CLI; deferred for future web UI)

## v0.5 — Reliability & evals (done)

## v0.6 — Advanced (done)

## v0.7 — Advanced polish (done)
- [x] Enhanced doom-loop: canonical fingerprints (sorted keys), text repetition, escalate action
- [x] Richer hooks: PermissionRequest, SessionStart/End, PostModelCall, mutatedInput/block
- [x] Tool context / shared context (plumbed via opts)
- [x] Format converters (src/formats.js)
- [x] OpenTelemetry export (src/telemetry.js)
- [ ] Async/background/deferred tools + universal `task` tool — deferred
- [ ] Tool sets — declarative activation — deferred
- [ ] Full state-diff eval grading + seeded mocks — deferred
- [ ] Large-tool-set stress test — deferred
- [ ] Advanced routing: stage router, advisor gate — deferred (capability + escalation done)
- [ ] TOML route config + proxy mode — deferred
- [ ] Benchmark suites with model tiers — deferred
- [ ] SKILL.md import + TUI patterns — deferred
- [x] Richer hooks with mutation/blocking (src/hooks.js)
- [x] Enhanced doom-loop (text repetition, escalate)
- [x] State-diff eval grading + seeded mocks (mockmcp, expectedStateValue)
- [x] Advanced routing (capability + escalation strategies)
- [x] Conversation state accessor (src/state.js)
- [ ] Async/background/deferred tools + task tool — deferred
- [ ] Tool context / shared context — deferred
- [ ] Tool sets (declarative activation) — deferred
- [ ] Format converters — deferred
- [ ] OpenTelemetry export — deferred
- [x] Doom-loop detection (fingerprint-based, graduated ladder)
- [x] Composable stop conditions (stepCountIs, maxTokensUsed, maxCost, hasToolCall)
- [x] Multi-backend router (round-robin/random, OpenAI-compat + Ollama)
- [x] State-diff eval grading (tool-sequence subsequence matching)
- [x] Mock MCP fixture (src/testing/mockmcp.js)
- [ ] Outcome/state grading (full state diff) — deferred
- [ ] Benchmark suites + cost tiers (from benchmark-harness) — deferred
- [ ] Conversation state accessor (load/save) — deferred
- [ ] Tool context / shared context — deferred

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
