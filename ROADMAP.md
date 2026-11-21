# Roadmap — AegisAi Harness

Tracked milestones. Checkboxes are the source of truth; update as work lands.

## Status & next
- **Shipped:** v0.1–v0.24 (24 milestones). All five v0.24 P1 items landed: multi-agent teams, headless JSON CLI, context files, read-only mode, token-efficient Markdown extraction. 22 issues closed, 21 tests passing.
- **Roadmap is edited as work lands** — each item is checked off in the Active backlog below when implemented.
- **Next candidates (v0.25):** agent lifecycle, PII protection layer, governance charter, Windows/FS robustness, model×harness pairing evals, graph/bi-temporal memory. Pick from P1 below.
- **Defer:** in-process model loading, Rust SDK, microVM/K8s/eBPF sandboxing, multi-tenant isolation, A2A/ACP protocol adapters until a concrete integration need appears.

## Completed milestones
- **v0.1 Scaffold** — repo, core modules, backends, agent loop, tools, SQLite, CLI, smoke test.
- **v0.2 Safety & context** — sandbox, approvals, MCP, compaction, token budget, offline mode, archive.
- **v0.3 Capability** — profiles, subagents, replay, code indexing, hooks, signed plugins, REPL.
- **v0.4 Quality** — tracing, evals, resilience, vault, backup/restore.
- **v0.5 Reliability** — doom-loop, stop conditions, router, state-diff evals, mock MCP.
- **v0.6 Advanced** — richer hooks, doom-loop escalation, seeded mocks, capability routing, state accessor.
- **v0.7 Polish** — canonical fingerprints, PermissionRequest/SessionStart-End/PostModelCall hooks, tool context, format converters, OTel export.
- **v0.8 Backlog** — tool sets, SKILL.md import, OpenAI-compat proxy.
- **v0.9 Heavy items** — async/task tools, state-diff grading, 1,595-tool stress, stage/advisor routing, TOML config, benchmarks.
- **v0.10 Ecosystem #1** — policy engine, sandbox rings, skill auto-create, session search, capture, basic hooks.
- **v0.11 Packaging** — build/install scripts, update checker, web UI, Tauri scaffold.
- **v0.12 Ecosystem #2** — context research (items either done later or deferred below).
- **v0.13 Deepened #2** — repo map, guardrails, token counting, handoffs, llms.txt.
- **v0.14 Ecosystem #3** — web UI panels, backup, Docker, real RE wiring, project allowlist, auth/rate limit.
- **v0.15 Own repos** — web UI branching, PWA, approval UI, model mgmt, installers, voice.
- **v0.16 High-value** — integrations/skills/memory panels, version/error-log UI, Docker, RE wiring.
- **v0.17 Observability** — run capture, harness score, reliability attribution, always-on layer.
- **v0.18 Focus** — progressive tool discovery, output compression, verification, decision memory, plan mode, update download, binary build.
- **v0.19 Voice** — Web Speech API STT/TTS + backend URLs.
- **v0.20 Orchestration** — DAG waves + multi-critic evaluation.
- **v0.21 Computer use** — CDP browser tools.
- **v0.22 Quality gates** — skill evaluator, harness lint, adversarial tests, CI template.
- **v0.23 Trust & tuning** — MCP security scanner, source-bound memory, contract baselines, rollout optimizer, cron scheduling.
- **v0.24 Teams & interfaces** — multi-agent teams, headless JSON CLI, context files, read-only mode, Markdown extraction.

## Active backlog by theme

### P0 — next up
- [x] MCP security scanner (tool poisoning, typosquatting, hidden instructions) — src/mcp_security.js
- [x] Source-bound memory (memory entries cite sources) — src/source_memory.js
- [x] Contract-driven call-chain baselines + regression diff (shrt) — src/contracts.js
- [x] Harness optimizer from rollout trajectories — src/optimizer.js
- [x] Scheduled agents / cron with delivery — src/scheduler.js

### P1 — high value
- [x] Multi-agent teams (coordinator + specialists) — src/teams.js
- [x] Headless CLI JSON output for CI/CD (--json)
- [x] Context files (AGENTS.md-style project briefing) — src/context_files.js
- [x] Read-only boundary enforcement (formalize clean-room) — src/read_only.js
- [x] Token-efficient Markdown extraction from web pages — src/markdown_extract.js
- [ ] Agent lifecycle (credential rotation, orphan detection, decommissioning)
- [ ] PII & sensitive credential protection layer
- [ ] Governance charter + spec-driven enforcement
- [ ] Windows/FS robustness (from Claude Code issue analysis)
- [ ] Model×harness pairing evals
- [ ] Graph-based recall + bi-temporal memory graph
- [ ] Versioned archive of prompts/tool schemas
- [ ] Prompt templates + CLI themes + RPC mode
- [ ] Self-improvement loop (propose → eval → approve → ship)
- [ ] Skill package manager + MCP marketplace / plugin discoverability
- [ ] Requirement-driven eval generation + OTel-traced eval
- [ ] Connection profiles + mDNS discovery for local MCP/backend servers

### P2 — heavier / needs a concrete need
- [ ] ACP adapter (integrate harness as backend for apps)
- [ ] A2A protocol adapter
- [ ] Visual DAG editor UI
- [ ] Event-driven plugin architecture (Cordis-style)
- [ ] Extension registry / custom distributions
- [ ] Shadow AI discovery + governance dashboard
- [ ] Parallel task board with worktrees + dependency chains
- [ ] Local ASR/TTS models for capture (Qwen3-ASR/TTS)
- [ ] Multimodal realtime harness (see/hear/act + memory)
- [ ] Simulated browser for web agents
- [ ] Selection quoting for UI
- [ ] Real-world coding benchmarks (cline-bench, polyglot, long-horizon)
- [ ] Harness engineering docs: guides, teardowns, templates, playbooks

### Deferred — platform-scale
- [ ] In-process model loading (no separate inference server)
- [ ] MicroVM sandboxing / K8s sandbox backend / eBPF enforcement
- [ ] Multi-tenant isolation + 5-layer security
- [ ] Rust SDK / Rust runtime
- [ ] Deterministic durable execution (Temporal-style)

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
