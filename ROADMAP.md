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

## v0.4 — Quality & polish (P2)
- [ ] Tracing (per-iteration, per-tool timing, errors)
- [ ] Agent eval harness with rubrics
- [ ] Backend resilience (retries, circuit breakers, health checks)
- [ ] Encrypted local secret vault
- [ ] Full-state backup/restore
- [ ] Desktop packaging + offline auto-update
- [ ] Accessibility & theming

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
