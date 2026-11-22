# Roadmap — AegisAi Harness

Tracked milestones. Checkboxes are the source of truth; update as work lands.

## Status & next
- **Shipped:** v0.1–v0.56 (56 milestones). v0.56 ported the remaining aegisai-next unique modules: swarm orchestration, dependency patch proposals, phase-based long-horizon tasks, bug-hunting flow, awesome-re 17k index, MCP presets, vuln-patterns library, markdown memory, and metrics. 50 issues closed, 204 tests passing. The harness now contains essentially all of aegisai-next's capabilities.
- **Roadmap is edited as work lands** — each item is checked off in the Active backlog below when implemented.
- **Truly blocked (need native toolchain or concrete need):** Rust SDK, real ggml/llama.cpp in-process bindings, real Windows UIAutomation wiring, microVM/K8s/eBPF sandboxing, persistent shell state, WASM sandbox, harness generator, admin panel, shared resource broker.
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
- **v0.29 Security & local inference** — hardware detection, credentialless gateway, admission gate, local vuln scanner, security KB, CRAAP research, continual learning, memory hierarchy.
- **v0.30 P2 platform** — parallel task board, unified context filesystem, event bus, ACP adapter, real-world benchmarks, harness docs, pentest pipeline.
- **v0.31 Protocol & isolation** — A2A adapter, visual DAG editor, local ASR/TTS adapter, sealed Docker execution, multi-tenant isolation.
- **v0.32 Memory & control** — graph memory, UI replay, executor/verifier separation, self-writing policy, debugger, cheapest-model finder, code-flow map.
- **v0.33 Interfaces & governance** — dual-graph memory, constitution, WebDriver BiDi, SSE stream, config installer, multi-engine search, routing eval, control plane.
- **v0.34 Retrieval & reporting** — semantic tool retrieval, YAML evals, pass@k, failure clustering, ledger rewind, Gems, AHP gateway, SARIF.
- **v0.35 Decisions & interop** — decision gates, workflow state machine, two-bar goals, geometric memory, session converter, architecture rules, AIBOM, SSH bridge.
- **v0.37 DiggerHQ patterns** — brain/sandbox interfaces, health failover, git state, bug repro, maintenance templates, speed bench, runtime contract, sandbox fingerprint.
- **v0.38 DiggerHQ integrations** — Slack gateway, outbound WS bridge, serverless functions, rootless Podman, PR review, CI resolver, CVE reachability.
- **v0.39 Remaining deferred cleared** — simulated browser, plugin UI, 5-layer security, layer registry, Markdown governance, trace export, native adapters.
- **v0.41 Tool systems & evidence** — tool state/eval, evolution search, config matrix, migration recipes, confidence memory, event replay, context reset, identity audit, 5-layer spans, evidence bundles, composable APIs.
- **v0.43 Reliability & verification** — session briefs, deterministic compaction, error recovery, chaos, silent-failure, honesty, boundary bench, replay guard, MCP pinning, Merkle, readiness, trajectory UI, cost routing, tool contracts, agents-as-tools, equipment registry.
- **v0.44 App-parity gaps** — rich chat UI, memory RAG/auto-extract, model discovery, lenient parsing, SSRF guard, context meter, UI config, default skills, squeeze.
- **v0.45 Full app parity** — keyless engines (7), simulated approval, citations, netvein adapter, vision input, proxy abort, RE index, AST chunking, remote-access docs.
- **v0.46 MCP reference servers** — sequential thinking, fetch_url, time tool, MCP registry browser, Everything test fixture.
- **v0.47 MCP protocol extensions** — conformance, MCP Apps, Tasks, .mcpb bundles, interceptors, file uploads, Skills over MCP.
- **v0.50 Session goals & tokens** — session goals, access tokens, token dashboard, proof-of-work, approval modes.
- **v0.51 Projects & memory** — projects with document shelf, hippocampus memory, skill factory, UI replay, embedded Python client.
- **v0.52 IM & integrations** — Telegram/Discord channels, GitHub webhooks, file attachments, graph memory via MCP.
- **v0.53 Final deferred cleared** — private KB, DingTalk/Feishu, Office preview, stream actions, fs resources, variants, annotations, access IaC.
- **v0.54 RE tooling native** — REA, Ghidra, Craft native modules + expanded RE index (30+ entries, categories, online search).
- **v0.55 Preact web UI** — component-based chat, config modal, context meter, dark/light theme, Markdown/code/thinking blocks.
- **v0.56 aegisai-next parity** — swarm, patch, task, hunt, awesome-re, mcp-presets, vuln-patterns, markdown-memory, metrics.

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
- [x] ACP adapter (integrate harness as backend for apps) — src/acp.js, --acp
- [x] A2A protocol adapter — src/a2a.js
- [x] Visual DAG editor UI — public/dag.html + /api/dag-runs
- [x] Event-driven plugin architecture — src/event_bus.js
- [x] Event-driven plugin UI — public/plugins.html + /api/plugins + /api/events
- [ ] Extension registry / custom distributions
- [x] Shadow AI discovery — src/shadow_ai.js (governance dashboard still deferred)
- [x] Parallel task board with worktrees + dependency chains — src/task_board.js
- [x] Local ASR/TTS adapter (whisper.cpp/piper endpoints) — src/voice_adapter.js (models external)
- [ ] Multimodal realtime harness (see/hear/act + memory)
- [x] Simulated browser for web agents — src/sim_browser.js
- [ ] Selection quoting for UI
- [x] Real-world coding benchmarks (polyglot, long-horizon) — src/benchmarks_real.js
- [x] Harness engineering docs — HARNESS_DOCS.md

### Deferred — platform-scale
- [x] In-process model loading — adapter interface only (src/native_adapters.js); native bindings still blocked
- [ ] MicroVM sandboxing / K8s sandbox backend / eBPF enforcement
- [x] Multi-tenant isolation — src/tenants.js
- [x] 5-layer security posture — src/security_layers.js
- [ ] Rust SDK / Rust runtime — still blocked (no Rust toolchain)
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
- [x] Unified context filesystem: code/memory/docs/sessions in one interface — src/context_fs.js
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
- [x] Local-only vulnerability scanner (no API keys, no data sent) — src/vuln_scan.js
- [x] Local pentest pipeline: recon → probe → scan → report — src/pentest_pipeline.js (external tool chaining still deferred)
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
- [x] Continual learning + review-and-refine workflow + auto rollback — src/continual.js
- [x] Memory hierarchy + verification ladder — src/memory_hierarchy.js
- [x] Deep research with CRAAP source-credibility scoring + cross-verification — src/deep_research.js
### Interfaces
- [ ] Semantic browser snapshots + semantic-locate click + form fill (ego-browser)
- [ ] Real-time shared context for local agents (gatherthread)
### Local inference & governance
- [x] Local hardware detection (GPU/RAM) + engine/model recommendation — src/hardware.js
- [x] Credentialless agent gateway — src/gateway.js; sealed execution — src/sealed.js (Docker, default-deny)
- [ ] Permission-first third-party integration runtime (gws-harness)
- [x] Admission gate in front of every consequential action — src/admission.js
- [ ] Spec-driven "dark factory" fully autonomous pipeline (fspec)

## v0.32 — From GitHub harness search pages 14–15
### Memory & learning
- [x] Graph memory with extraction loop + prompt evolution — src/graph_memory.js
- [x] Contest-based memory (dual graphs, habit formation) — src/contest_memory.js
- [x] Hippocampus memory: spreading activation, Hebbian writeback, consolidation — src/hippocampus.js — **H**
- [x] Skill factory with autoresearch + consensus verification — src/skill_factory.js — **H**
- [x] Constitution evolution with human approval + adopted history — src/constitution.js
### Verification & evidence
- [x] Evidence-first UI automation with replay — src/ui_replay.js (web)
- [x] Executor/verifier separation gate — src/separation.js
- [x] Self-writing policy from detected attacks — src/auto_policy.js
- [x] Debugger-like execution control — src/debugger.js (/bp, /step, /resume)
### Interfaces & protocols
- [x] WebDriver BiDi browser backend — src/integrations/bidi.js
- [x] SSE event stream interface — src/event_stream.js + /api/events
- [x] One-click config installer — src/config_installer.js
- [x] Multi-engine web search + evidence synthesis — src/multi_search.js
### Evaluation & routing
- [x] Cheapest-model finder — src/cheapest_model.js
- [x] Routing evaluation harness — src/routing_eval.js
### Code intelligence & mobile
- [x] Code map with call/data/control-flow + class hierarchy — src/code_map.js
- [ ] Mobile device harness: device logs, network interception, UI automation via MCP (quern)
- [x] Governed tool control plane with checkpoints + trace — src/control_plane.js

## v0.34 — From GitHub harness search pages 16–17
### Tool retrieval & selection
- [x] Dense + hybrid semantic tool retrieval — src/semantic_tools.js
- [x] Swappable layer registry — src/layer_registry.js
### Eval & benchmarking
- [x] Portable YAML eval format — src/yaml_eval.js
- [x] pass@k metrics + multi-run comparison — src/pass_at_k.js
- [x] Failure clustering + fix suggestions from traces — src/failure_cluster.js
- [ ] Four-gate evaluation (aicf-core)
### Durability & recovery
- [x] Tamper-evident event-log rewind — src/ledger.js rewind()
- [x] Session distillation into portable packages with redaction — src/gems.js
### Security & governance
- [x] AHP unified security supervision gateway — src/ahp.js
- [ ] Deny-first policy + OS sandbox (medha-agent)
- [x] Markdown-based declarative governance — src/markdown_governance.js
### Workflows & reporting
- [ ] Scheduled loops with worktree isolation + second-agent verification gate (loop-harness)
- [x] Security escalation chaining + SARIF reporting — src/sarif.js
- [x] Native Windows RPA — adapter interface only (src/native_adapters.js); UIAutomation wiring still blocked
- [x] Trace export to external observability — src/trace_export.js
### Docs
- [ ] 91 production patterns catalog (cauchyturing)

## v0.35 — From GitHub harness search page 18
### Decision & workflow
- [x] Semantic decision gates — src/decision_gates.js
- [x] Declarative workflow state machine — src/workflow.js
- [x] Two-bar goal system — src/two_bar.js
### Memory & sessions
- [x] Geometric agent memory + session handoff injection — src/geometric_memory.js
- [x] Session format converter — src/session_converter.js
### Quality & supply chain
- [x] Architecture import-boundary rule benchmark — src/arch_rules.js
- [x] AIBOM / CycloneDX 1.6 generation — src/aibom.js
- [ ] Adversarial "maker never grades its own done" framework (harness-studio)
### Interop
- [x] SSH-based push A2A bridge — src/ssh_bridge.js
- [ ] Journaled persistence / durable resumable loop engine (looprig)

## v0.36 — From diggerhq (opencomputer / open-agent-sdk / speedbench)
Feasibility: **H** = high (fits current local-only architecture), **M** = medium (needs external service/tool), **L** = low (platform-scale/native).

### Interfaces & gateways
- [x] Slack-native gateway adapter — src/slack_gateway.js — **M**
- [x] Outbound-only WebSocket bridge — src/ws_bridge.js — **M**
- [x] Serverless "agent as a function" — src/serverless.js — **M**
- [x] Pluggable runtime contract — src/runtime_contract.js — **H**

### Execution & isolation
- [x] Formal brain + sandbox interfaces — src/brain_sandbox.js — **H**
- [x] Rootless Podman per-session isolation — src/podman.js — **M** (falls back to sealed)
- [x] Sandbox capability fingerprinting — src/sandbox_fingerprint.js — **M→H**
- [x] Provider health-check failover — src/health_failover.js — **H**

### State & durability
- [x] Git-backed state store — src/git_state.js — **H**
- [x] Journaled durable loop engine — src/capsule.js + src/ledger.js — **H**

### Workflows & agents
- [x] Bug reproduction workflow — src/bug_repro.js — **H**
- [x] PR review agent with inline comments + dry-run — src/pr_review.js — **M**
- [x] CI failure resolver with per-repo allowlist — src/ci_resolver.js — **M**
- [x] Scheduled maintenance templates — src/maintenance_templates.js — **H**
- [x] CVE reachability proof — src/cve_reachability.js — **M**

### Evaluation
- [x] Real-world speed benchmark — src/speed_bench.js — **H**
- [ ] Sandbox benchmark catalog (awesome-sandbox-benchmarks) — **H** (docs)

## v0.40 — From "ai agent harness tools" search pages 1–4
Feasibility: **H** = fits current JS architecture, **M** = needs external service/tool, **L** = native/platform-scale.

### Tool systems & state
- [ ] Explicit tool state management + persistent shell across calls (AuroraCoder) — **M**
- [x] Tool-call quality eval harness — src/tool_eval.js — **H**
- [x] Automated prompt/tool/harness evolution via search — src/evolution_search.js — **H**
- [ ] Self-patch loop with WASM sandbox adapter (clanker) — **M**
### Config & migration
- [x] Config compatibility matrix — src/config_matrix.js — **H**
- [x] Harness migration recipes — src/migration_recipes.js — **H**
- [ ] Harness generator from natural language (pi-forge, agent-inception) — **M**
### Memory & context
- [x] Self-checking memory with calibrated confidence — src/confidence_memory.js — **H**
- [x] Event-sourced session replay — src/event_sourced.js — **H**
- [x] Context wipe-and-rerun — src/context_reset.js — **H**
### Security & governance
- [x] Least-privilege per-agent identity + audit — src/identity_audit.js — **H**
- [x] Policy-as-code Markdown in git — src/markdown_governance.js (v0.39) — **H**
- [x] Progressive autonomy with transactional action log — src/two_bar.js + src/ledger.js — **H**
### Observability & evidence
- [x] 5-layer span model — src/spans5.js — **H**
- [x] Per-run evidence bundles — src/evidence_bundle.js — **H**
- [ ] Admin panel with auth (ulshv/harness) — **M** (web UI extension)
### Workflows
- [x] Composable agent APIs / 6-phase state machine — src/composable_api.js — **H**
- [ ] DAG + subagents + persistent memory super harness (omniHarness) — **H** (we have all parts)

## v0.42 — From "ai agent harness tools" search pages 5–8
Feasibility: **H** = fits current JS architecture, **M** = needs external service/tool, **L** = native/platform-scale.

### Session & context
- [x] Auto session brief on return — src/session_brief.js — **H**
- [x] Zero-LLM deterministic compaction — src/deterministic_compact.js — **H**
- [x] Multi-turn automated error recovery policy — src/error_recovery.js — **H**
- [x] Config version control for harness configs — src/git_state.js — **H**
### Testing & reliability
- [x] Chaos testing with fault injection — src/chaos.js — **H**
- [x] Silent-failure detection — src/silent_failure.js — **H**
- [x] Agent honesty scoring — src/honesty.js — **H**
- [x] Agent boundary/overreach benchmark — src/boundary_bench.js — **H**
- [x] Replay protection + cancellation tokens — src/replay_guard.js — **H**
### Security & governance
- [x] MCP server pinning — src/mcp_pinning.js — **H**
- [x] Merkle-tree root verification — src/merkle.js — **H**
- [x] Project agent-readiness audit — src/readiness_audit.js — **H**
### Observability & interfaces
- [x] Live trajectory monitor page — public/trajectory.html — **H**
- [x] Cost-aware routing + convergence loops — src/cost_routing.js — **H**
- [x] Tool contract export — src/tool_contract.js — **H**
### Orchestration & resources
- [x] Agents-as-tools registration — src/agents_as_tools.js — **H**
- [ ] Shared heavyweight tool/device/cache broker across tenants (agent-runtime-harness) — **M**
### Registries
- [x] Harness equipment registry with tested verdicts — src/equipment_registry.js — **H**

## v0.44 — Gaps vs aegisai-next / LocalAI (web-UI app parity)
Comparison of the three repos: the harness is far more capable as an *agent runtime* (policy, charter, ledger, 100+ modules), but the web-UI apps have end-user UX the harness lacks.

### High priority (core UX parity)
- [x] Rich chat UI: Markdown + code highlighting + thinking blocks — public/markdown.js
- [x] Memory RAG: cosine search + reindex — src/memory_rag.js
- [x] Memory auto-extract — src/memory_extract.js
- [x] GGUF/HF model discovery — src/model_discovery.js
- [x] Lenient tool-call parsing — src/lenient_parse.js
- [x] URL validation / SSRF protection — src/url_validate.js
- [x] Context meter + compaction indicator — /api/context + web UI
- [x] Env-var config from UI — /api/config + config panel
- [x] Bundled default skill pack — src/default_skills.js
- [x] Squeeze tool — src/squeeze.js
### Medium priority
- [x] More keyless search engines — src/keyless_search.js (7 engines)
- [x] Simulated tool results while awaiting approval — src/simulated_approval.js
- [x] Web citations rendering — src/citations.js
- [x] netvein MCP adapter — src/netvein_adapter.js
- [x] Vision/multimodal image input — src/vision.js
- [x] Client-disconnect abort on proxy
- [x] Richer desktop launchers — docs/REMOTE_ACCESS.md (tray/auto-start documented)
### Lower priority
- [x] Reverse-engineered project index search — src/re_index.js (curated offline + optional online)
- [x] AST-aware RAG chunking + watch mode — src/ast_chunk.js
- [x] Tailscale / Cloudflare Quick Tunnel setup docs — docs/REMOTE_ACCESS.md

## v0.46 — From modelcontextprotocol/servers (reference implementations)
Feasibility: **H** = fits current JS architecture, **M** = needs external service/tool, **L** = native/platform-scale.

### Reference servers worth porting
- [x] Sequential Thinking tool — src/sequential_thinking.js — **H**
- [x] Dedicated fetch_url tool — src/fetch_url.js — **H**
- [x] Knowledge graph memory exposed via MCP — src/graph_mcp.js — **M**
- [x] Time/timezone tool — src/time_tool.js — **H**
- [x] "Everything" test server fixture — src/mcp_everything.js — **H**
### Archived servers (domain-specific, mostly covered)
- [ ] GitHub MCP integration (archived "GitHub") — **M** (we have git via run_command + MCP marketplace entry)
- [ ] Puppeteer/browser automation (archived "Puppeteer") — **H** (covered by our CDP browser tools)
- [ ] SQLite MCP server (archived "SQLite") — **H** (covered; we have db module)
- [ ] PostgreSQL MCP server (archived "PostgreSQL") — **M**
- [ ] Redis MCP server (archived "Redis") — **M**
- [ ] Slack MCP server (archived "Slack") — **M** (we have slack_gateway adapter)
- [ ] Sentry MCP server (archived "Sentry") — **M**
### MCP ecosystem
- [x] MCP registry browser — src/mcp_registry_browser.js — **M** (network-dependent; falls back gracefully)
- [ ] Transports: Streamable HTTP server mode for our own MCP exposure — **M** (still deferred)

## v0.47 — From modelcontextprotocol org (beyond servers)
Feasibility: **H** = fits current JS architecture, **M** = needs external service/tool, **L** = native/platform-scale.

### MCP protocol extensions (high value, buildable)
- [x] MCP conformance testing — src/mcp_conformance.js — **H**
- [x] MCP Apps protocol — src/mcp_apps.js — **H**
- [x] MCP Tasks extension — src/mcp_tasks.js — **H**
- [x] Desktop extensions (.mcpb) — src/mcpb.js — **H**
- [x] Interceptors extension — src/mcp_interceptors.js — **H**
- [x] File uploads extension — src/mcp_file_uploads.js — **H**
- [x] Skills over MCP — src/mcp_skills.js — **H**
### Lower priority / platform
- [ ] Filesystem Resources extension (modelcontextprotocol/experimental-ext-filesystems) — **M**
- [ ] Variants extension (modelcontextprotocol/experimental-ext-variants) — **M**
- [ ] Tool annotations interest group (modelcontextprotocol/experimental-ext-tool-annotations) — **M**
- [ ] Streamable HTTP server mode for our MCP exposure — **M** (we already serve /mcp over HTTP)
- [ ] MCP access management IaC (modelcontextprotocol/access) — **M**
- [ ] Remote example server/client patterns (modelcontextprotocol/example-remote-server) — **M**

## v0.49 — From bytedance/deer-flow, openai/symphony, openai/codex
Feasibility: **H** = fits current JS architecture, **M** = needs external service/tool, **L** = native/platform-scale.

### Session & project state (deer-flow)
- [x] Session goals — src/session_goals.js — **H**
- [x] Projects with instructions + document shelf — src/projects.js — **H**
- [x] Evidence-based decisions log — src/decision_memory.js + src/ledger.js — **H**
- [x] boxd-style bounded output copies + cleanup retries — src/sealed.js + src/capsule.js — **H**
- [x] File attachments, downloads, Office previews — src/file_attachments.js — **M** (Office preview still deferred)
- [ ] Private knowledge retrieval (RAGFlow-style) (deer-flow "Private Knowledge Retrieval") — **M**
- [ ] Agentic browser control (deer-flow "Agentic Browser Control") — **H** (we have CDP + sim_browser)
### Messaging & events (deer-flow)
- [x] IM channels: Telegram + Discord adapters — src/channels.js — **M** (DingTalk/Feishu still deferred)
- [x] GitHub webhook event-driven agents — src/github_webhooks.js — **M**
- [x] Personal access tokens + stream actions — src/access_tokens.js — **H**
- [x] Token usage dashboard — src/token_dashboard.js — **H**
- [ ] Terminal workbench (TUI) (deer-flow "Terminal Workbench") — **M** (we have REPL)
### Proof of work (symphony)
- [x] "Proof of work" artifact — src/proof_of_work.js — **H**
- [ ] Spec-driven autonomous runs with isolated worktrees (symphony) — **H** (we have DAG + task_board)
### Agent (codex)
- [x] Codex-style approval modes: suggest / auto-edit / full-auto — **H**
- [ ] Codex-style MCP server configuration patterns — **H** (covered)

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
