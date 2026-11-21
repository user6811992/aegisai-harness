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

## v0.2 — Safety & context (P0) (done)
- [x] Sandboxed tool execution
- [x] Human-in-the-loop approval gates
- [x] MCP client (stdio + HTTP)
- [x] Context compaction
- [x] Token budgeting & accounting
- [x] Offline mode toggle
- [x] Retrievable archive / expand-on-demand

## v0.3 — Capability (P1) (done)
- [x] Named agents/profiles
- [x] Subagents / delegation + parallel tool calls
- [x] Deterministic replay
- [x] Code/repo indexing
- [x] Hooks/transforms
- [x] Signed plugins
- [x] CLI/TUI (REPL)

## v0.4 — Quality & polish (P2) (done)
- [x] Tracing
- [x] Agent eval harness
- [x] Backend resilience
- [x] Encrypted secret vault
- [x] Full-state backup/restore
- [ ] Desktop packaging (deferred)
- [ ] Accessibility & theming (deferred)

## v0.5 — Reliability & evals (done)
- [x] Doom-loop detection (basic)
- [x] Composable stop conditions
- [x] Multi-backend router (round-robin/random)
- [x] State-diff eval grading (tool-sequence)
- [x] Mock MCP fixture

## v0.6 — Advanced (done)
- [x] Richer hooks with mutation/blocking
- [x] Enhanced doom-loop (text repetition, escalate)
- [x] State-diff eval grading + seeded mocks
- [x] Advanced routing (capability + escalation)
- [x] Conversation state accessor

## v0.7 — Advanced polish (done)
- [x] Enhanced doom-loop canonical fingerprints
- [x] Richer hooks (PermissionRequest, SessionStart/End, PostModelCall)
- [x] Tool context / shared context
- [x] Format converters
- [x] OpenTelemetry export

## v0.8 — Deferred backlog (done)
- [x] Tool sets (declarative activation)
- [x] SKILL.md import
- [x] Standalone OpenAI-compat proxy mode

## v0.9 — Heavy items (done)
- [x] v0.9.0 Async/background tools + universal `task` tool
- [x] v0.9.1 Full state-diff eval grading + seeded mocks
- [x] v0.9.2 Large-tool-set stress test (1,595 tools)
- [x] v0.9.3 Advanced routing: stage router, advisor gate
- [x] v0.9.4 TOML route config
- [x] v0.9.5 Benchmark suites with model tiers + reporting

## Remaining deferred
- [ ] Async/background/deferred tools — full cross-process deferred lifecycle
- [ ] Tool sets — declarative activation by situation (basic done)
- [ ] Full state-diff eval grading — full state comparison (basic done)
- [ ] Large-tool-set stress test — done
- [ ] Advanced routing: stage router, advisor gate — basic done
- [ ] TOML route config — basic done
- [ ] Benchmark suites — basic done
- [ ] Desktop packaging + offline auto-update
- [ ] Accessibility & theming

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
