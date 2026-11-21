# Roadmap — AegisAi Harness

Tracked milestones. Checkboxes are the source of truth; update as work lands.

## Status & next
- **Shipped:** v0.1–v0.28 (28 milestones). v0.28 added runtime manager, shadow AI discovery, skill package manager, MCP marketplace, self-improvement loop, prompt templates/themes/RPC, declarative harness-as-code, and multi-harness config discovery. 26 issues closed, 44 tests passing.
- **Roadmap is edited as work lands** — each item is checked off in the Active backlog below when implemented.
- **Remaining P2 candidates:** parallel task board, unified context filesystem, ACP/A2A adapters, visual DAG editor, event-driven plugins, local ASR/TTS, simulated browser, real-world coding benchmarks, harness docs.
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
- **v0.25 Trust & governance** — agent lifecycle, PII redaction, governance charter, Windows/FS robustness, pairing evals, bi-temporal memory.
- **v0.26 Audit & evolution** — hash-chained ledger, action guardrails, counterfactual evolution, file-first verification, waste detection, agent mailbox.
- **v0.27 Context & control** — AX-first browser, context capsules + auto-compaction, action rollback, task state, web search, slop filter, peer review.
- **v0.28 Ecosystem & tooling** — runtime manager, shadow AI, skill packages, MCP marketplace, self-improvement, templates/themes/RPC, harness-as-code, config discovery.

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
- [x] Agent lifecycle (credential rotation, orphan detection, decommissioning) — src/lifecycle.js
- [x] PII & sensitive credential protection layer — src/pii.js
- [x] Governance charter + spec-driven enforcement — src/charter.js
- [x] Windows/FS robustness — src/fs_robust.js + wired into coding tools
- [x] Model×harness pairing evals — src/pairing.js
- [x] Graph-based recall + bi-temporal memory graph — src/temporal_memory.js
- [ ] Versioned archive of prompts/tool schemas
- [x] Prompt templates + CLI themes + RPC mode — src/prompt_templates.js, src/themes.js, --rpc
- [x] Self-improvement loop (propose → eval → approve → ship) — src/self_improve.js
- [x] Skill package manager + MCP marketplace — src/skill_pkg.js, src/mcp_marketplace.js
- [ ] Requirement-driven eval generation + OTel-traced eval
- [ ] Connection profiles + mDNS discovery for local MCP/backend servers

### P2 — heavier / needs a concrete need
- [ ] ACP adapter (integrate harness as backend for apps)
- [ ] A2A protocol adapter
- [ ] Visual DAG editor UI
- [ ] Event-driven plugin architecture (Cordis-style)
- [ ] Extension registry / custom distributions
- [x] Shadow AI discovery — src/shadow_ai.js (governance dashboard still deferred)
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

## v0.26 — From GitHub harness search pages 7–9
### Guardrails & safety
- [x] Evidence-based action guardrails (gate what agents DO, not just say) — src/action_guard.js
- [ ] Pre-execution Git/FS safety rules + sensitive-file blocking (cc-safety-net)
- [ ] Default-deny sandbox policies + external credential injection (strands-agents/box)
- [ ] Fail-closed cross-model review gate + "constitution" (turbo-flow)
- [x] Waste detection: over-verification, repeated reads, false completion — src/waste.js
### Audit & verification
- [x] Hash-chained, offline-verifiable audit ledger with replay — src/ledger.js
- [ ] Tamper-evident evidence at every SDLC step (ai-sdlc-harness)
- [x] File-first verification: "I'm done" → auditable admission decision — src/verifier.js verifyFiles
- [ ] Typed evaluation + provider-neutral evidence grading + provenance (nano-step/eval-harness)
- [ ] Multimodal evidence capture: video/audio/screen → timestamped contracts (watch-skill)
### Harness as code & optimization
- [x] Declarative harness-as-code — src/harness_spec.js (visualizer still deferred)
- [x] Counterfactual trace diagnosis → automated harness evolution — src/counterfactual.js
- [ ] Meta-harness local hooks + developer observability (interlinked-cli)
- [ ] Prompt-cache optimization patches (prompt-cache-skills)
### Context & memory
- [ ] Unified context filesystem: code/memory/docs/DB/SaaS in one interface (zilliztech/mfs)
- [ ] Explainable retrieval + portable context across harnesses (ContextLattice)
- [ ] Git history + blame code-map integration (basemind)
- [ ] Ambient self-learning memory (syke)
### Orchestration & messaging
- [x] Async agent mailbox protocol (AMP) — src/mailbox.js
- [ ] Threads + structured episodes for long-running tasks (arcee-ai/nac)
- [ ] Worker → reviewer loop (athena-loops)
- [ ] Cross-harness messaging + shared history (flopwire)
- [ ] Transparent multi-model routing display (Albatross)
### Interfaces
- [ ] Hermetic sandbox runtime + Harness Protocol (ComputerAgent)
- [ ] Browser side-panel control in logged-in Chrome (browsentic)
- [ ] Interop layer connecting agents/harnesses/robots (hybroai/hybro)

## v0.27 — From GitHub harness search pages 10–12
### Browser & computer use
- [x] Accessibility-first browser use: diffed AX-tree snapshots, stable element refs (axuse) — browser_ax/click_ref/type_ref
- [ ] Drive real logged-in Chrome from any harness (open-web-bridge)
- [ ] Interactive PTY terminal tool for agents (term-cli)
### Context & compaction
- [x] Context capsule checkpointing at threshold + resume — src/capsule.js
- [x] Agent-decided auto-compaction (agent chooses when/what to retain) — agentCompact option
- [ ] Cross-device, cross-agent session sync (agentctxsync)
- [ ] Harness-based RAG without embeddings/vector DB — LLM reads all (sourcelens)
### Orchestration & process
- [ ] Design contracts before implementation (dely)
- [x] Structured task state instead of chat history — src/task_state.js
- [ ] Goals + Heartbeat + Dream background agent loop (talon)
- [ ] Five-agent pipeline (scope/plan/build/verify/learn) with proof chain (anatomia)
- [ ] Thinking/acting model routing (loom)
- [ ] Persistent task graph + worktree isolation (q-code)
### Verification & security
- [x] Cross-LLM peer review before completion/PR — src/peer_review.js
- [ ] Red-team/blue-team test suite: MCP, A2A, governance, supply chain (msaleme fabric)
- [x] Content review / slop filter — src/content_review.js
- [x] Action rollback capability — src/rollback.js
- [ ] Ablatable memory for evals + deterministic simulations (Durable-agent-harness)
### Tooling & discovery
- [x] Agent-native web search with keyless defaults — src/web_search.js
- [ ] Agent asset package manager (harness-ai-kit)
- [ ] Multi-harness config/path/MCP discovery library (harness-barn)
- [ ] Interoperability with any harness via ACP/protocol bridges (multiple)

## v0.29 — From bughunter searches + harness search page 13
### Security & bug hunting
- [ ] Security skill library / vulnerability knowledge base (82 skills, 681 report patterns across 24 vuln classes — Claude-BugHunter)
- [ ] Local-only vulnerability scanner (no API keys, no data sent) (bughunter-copg)
- [ ] Local-LLM pentest pipeline: recon → probe → sqlmap/dalfox/nuclei → report (bughunter-harness)
- [ ] Bug-hunting agent team + Burp Suite MCP integration (bughunter-ai)
- [ ] Code bug graph (Neo4j-style) + semantic search over findings
- [ ] Phase-based recon workflow + auto HTML report (BugHunterX)
- [ ] Vulnerability-fixing benchmark (snyk-vulnbench)
### Coordination & multi-agent
- [ ] Live coordination protocol for parallel agents across harnesses (weft/WCP)
- [ ] Multiplayer shared context + group routing topologies (pioneer, qunica)
- [ ] tmux-based agent fleet orchestration, each pane siloed to a project (tmux-harness)
- [ ] Long-lived agent runtime (norns)
### Memory & learning
- [ ] Continual learning + review-and-refine workflow + auto rollback (dsh-continual-harness)
- [ ] Memory hierarchy + verification ladder (AMH)
- [ ] Deep research with CRAAP source-credibility scoring + cross-verification (harness-research)
### Interfaces
- [ ] Semantic browser snapshots + semantic-locate click + form fill (ego-browser)
- [ ] Real-time shared context for local agents (gatherthread)
### Local inference & governance
- [ ] Local hardware detection (GPU/RAM) + engine/model recommendation (local-ai-harness)
- [ ] Credentialless agent gateway + sealed containers for sensitive data (minervacomputing/harness)
- [ ] Permission-first third-party integration runtime (gws-harness)
- [ ] Admission gate in front of every consequential action (oracle/locus)
- [ ] Spec-driven "dark factory" fully autonomous pipeline (fspec)

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
