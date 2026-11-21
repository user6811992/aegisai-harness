# Roadmap — AegisAi Harness

Tracked milestones. Checkboxes are the source of truth; update as work lands.

## v0.1 — Scaffold (in progress)
- [x] Create private repo `aegisai-harness`
- [x] Initial project scaffold (package.json, .gitignore, README, ROADMAP)
- [ ] Core modules: config, logger, security, capabilities
- [ ] Backend adapter (Ollama + OpenAI-compat) with streaming
- [ ] Agent loop (tool calls, fallback, budget, clean-room)
- [ ] Tool registry + coding tools (file ops, shell, python, search)
- [ ] SQLite persistence (sessions, memories, skills)
- [ ] Basic CLI entry point
- [ ] Smoke test: run agent against local Ollama

## v0.2 — Safety & context (P0)
- [ ] Sandboxed tool execution (process isolation; no in-process plugin require)
- [ ] Human-in-the-loop approval gates for destructive tools
- [ ] Full MCP client (stdio + HTTP, discovery, reconnect)
- [ ] Context compaction + retrievable archive (replace last-N truncation)
- [ ] Token budgeting & accounting per run
- [ ] Offline mode toggle (disable network tools by default)

## v0.3 — Capability (P1)
- [ ] Named agents/profiles (prompt + tools + permissions + model)
- [ ] Subagents / delegation + parallel tool calls
- [ ] Deterministic replay from stored transcript
- [ ] Code/repo semantic indexing (file skeletons, symbols, usages)
- [ ] Hooks/transforms around model & tool calls
- [ ] Signed plugins with declared permissions
- [ ] CLI/TUI for headless operation

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
