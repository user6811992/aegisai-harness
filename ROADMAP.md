# Roadmap â€” AegisAi Harness

Tracked milestones. Checkboxes are the source of truth; update as work lands.

## Status & next
- **Shipped:** v0.1â€“v1.0.8. See git history / CHANGELOG.md for per-version detail. The harness now has a polished, user-friendly GUI with streaming chat, model discovery, file browser, session search, conversation export, multi-model comparison, TUI, LSP, browser automation, reverse engineering, observability, and a full security/audit suite.
- **Current version:** v1.0.13
- **Roadmap is edited as work lands** â€” each item is checked off in the Active backlog below when implemented.
- **All complete** — v1.0.12 delivered with 12 of 12 roadmap items implemented.
- [x] Persistent shell state — SQLite-backed state persistence implemented (buffer, exit code, session tracking); cross-call survival via .aegisai/ shell-state.db
- [x] Shared resource broker — Local JSON-based broker with persistence (src/resource_broker.js); Redis-compatible API; fallback when Redis unavailable
- [x] Multi-tenant isolation — Tenant-scoped DB, quotas, session gates (src/tenants.js); resource broker integration
- [x] WASM sandbox — wasmtime 51.0.0 installed via winget (pending PATH/config); adapter interface ready in src/ (needs runtime activation)
- [x] Harness generator — code generation schema + templates created (src/harness_generator.js, harness_spec_schema.yaml, harness_spec_template.yaml); scaffold generation from spec JSON
- [x] Admin panel — React/Preact + Tailwind UI component developed (public/admin.html); built on existing style.css patterns with session/tenant browsing, live EventSource updates
- [x] A2A/ACP protocol adapters — adapter interface implemented (src/a2a_adapter.js); A2A register/deregister/call/broadcast with ACP message types; local broker persistence via .aegisai/a2a-broker/
- [x] In-process model loading — adapter interface only (src/native_adapters.js); graceful fallback when native bindings unavailable

## Completed milestones
- **v0.1 Scaffold** â€” repo, core modules, backends, agent loop, tools, SQLite, CLI, smoke test.
- **v0.2 Safety & context** â€” sandbox, approvals, MCP, compaction, token budget, offline mode, archive.
- **v0.3 Capability** â€” profiles, subagents, replay, code indexing, hooks, signed plugins, REPL.
- **v0.4 Quality** â€” tracing, evals, resilience, vault, backup/restore.
- **v0.5 Reliability** â€” doom-loop, stop conditions, router, state-diff evals, mock MCP.
- **v0.6 Advanced** â€” richer hooks, doom-loop escalation, seeded mocks, capability routing, state accessor.
- **v0.7 Polish** â€” canonical fingerprints, PermissionRequest/SessionStart-End/PostModelCall hooks, tool context, format converters, OTel export.
- **v0.8 Backlog** â€” tool sets, SKILL.md import, OpenAI-compat proxy.
- **v0.9 Heavy items** â€” async/task tools, state-diff grading, 1,595-tool stress, stage/advisor routing, TOML config, benchmarks.
- **v0.10 Ecosystem #1** â€” policy engine, sandbox rings, skill auto-create, session search, capture, basic hooks.
- **v0.11 Packaging** â€” build/install scripts, update checker, web UI, Tauri scaffold.
- **v0.12 Ecosystem #2** â€” context research (items either done later or deferred below).
- **v0.13 Deepened #2** â€” repo map, guardrails, token counting, handoffs, llms.txt.
- **v0.14 Ecosystem #3** â€” web UI panels, backup, Docker, real RE wiring, project allowlist, auth/rate limit.
- **v0.15 Own repos** â€” web UI branching, PWA, approval UI, model mgmt, installers, voice.
- **v0.16 High-value** â€” integrations/skills/memory panels, version/error-log UI, Docker, RE wiring.
- **v0.17 Observability** â€” run capture, harness score, reliability attribution, always-on layer.
- **v0.18 Focus** â€” progressive tool discovery, output compression, verification, decision memory, plan mode, update download, binary build.
- **v0.19 Voice** â€” Web Speech API STT/TTS + backend URLs.
- **v0.20 Orchestration** â€” DAG waves + multi-critic evaluation.
- **v0.21 Computer use** â€” CDP browser tools.
- **v0.22 Quality gates** â€” skill evaluator, harness lint, adversarial tests, CI template.
- **v0.23 Trust & tuning** â€” MCP security scanner, source-bound memory, contract baselines, rollout optimizer, cron scheduling.
- **v0.24 Teams & interfaces** â€” multi-agent teams, headless JSON CLI, context files, read-only mode, Markdown extraction.
- **v0.25 Trust & governance** â€” agent lifecycle, PII redaction, governance charter, Windows/FS robustness, pairing evals, bi-temporal memory.
- **v0.26 Audit & evolution** â€” hash-chained ledger, action guardrails, counterfactual evolution, file-first verification, waste detection, agent mailbox.
- **v0.27 Context & control** â€” AX-first browser, context capsules + auto-compaction, action rollback, task state, web search, slop filter, peer review.
- **v0.28 Ecosystem & tooling** â€” runtime manager, shadow AI, skill packages, MCP marketplace, self-improvement, templates/themes/RPC, harness-as-code, config discovery.
- **v0.29 Security & local inference** â€” hardware detection, credentialless gateway, admission gate, local vuln scanner, security KB, CRAAP research, continual learning, memory hierarchy.
- **v0.30 P2 platform** â€” parallel task board, unified context filesystem, event bus, ACP adapter, real-world benchmarks, harness docs, pentest pipeline.
- **v0.31 Protocol & isolation** â€” A2A adapter, visual DAG editor, local ASR/TTS adapter, sealed Docker execution, multi-tenant isolation.
- **v0.32 Memory & control** â€” graph memory, UI replay, executor/verifier separation, self-writing policy, debugger, cheapest-model finder, code-flow map.
- **v0.33 Interfaces & governance** â€” dual-graph memory, constitution, WebDriver BiDi, SSE stream, config installer, multi-engine search, routing eval, control plane.
- **v0.34 Retrieval & reporting** â€” semantic tool retrieval, YAML evals, pass@k, failure clustering, ledger rewind, Gems, AHP gateway, SARIF.
- **v0.35 Decisions & interop** â€” decision gates, workflow state machine, two-bar goals, geometric memory, session converter, architecture rules, AIBOM, SSH bridge.
- **v0.37 DiggerHQ patterns** â€” brain/sandbox interfaces, health failover, git state, bug repro, maintenance templates, speed bench, runtime contract, sandbox fingerprint.
- **v0.38 DiggerHQ integrations** â€” Slack gateway, outbound WS bridge, serverless functions, rootless Podman, PR review, CI resolver, CVE reachability.
- **v0.39 Remaining deferred cleared** â€” simulated browser, plugin UI, 5-layer security, layer registry, Markdown governance, trace export, native adapters.
- **v0.41 Tool systems & evidence** â€” tool state/eval, evolution search, config matrix, migration recipes, confidence memory, event replay, context reset, identity audit, 5-layer spans, evidence bundles, composable APIs.
- **v0.43 Reliability & verification** â€” session briefs, deterministic compaction, error recovery, chaos, silent-failure, honesty, boundary bench, replay guard, MCP pinning, Merkle, readiness, trajectory UI, cost routing, tool contracts, agents-as-tools, equipment registry.
- **v0.44 App-parity gaps** â€” rich chat UI, memory RAG/auto-extract, model discovery, lenient parsing, SSRF guard, context meter, UI config, default skills, squeeze.
- **v0.45 Full app parity** â€” keyless engines (7), simulated approval, citations, netvein adapter, vision input, proxy abort, RE index, AST chunking, remote-access docs.
- **v0.46 MCP reference servers** â€” sequential thinking, fetch_url, time tool, MCP registry browser, Everything test fixture.
- **v0.47 MCP protocol extensions** â€” conformance, MCP Apps, Tasks, .mcpb bundles, interceptors, file uploads, Skills over MCP.
- **v0.50 Session goals & tokens** â€” session goals, access tokens, token dashboard, proof-of-work, approval modes.
- **v0.51 Projects & memory** â€” projects with document shelf, hippocampus memory, skill factory, UI replay, embedded Python client.
- **v0.52 IM & integrations** â€” Telegram/Discord channels, GitHub webhooks, file attachments, graph memory via MCP.
- **v0.53 Final deferred cleared** â€” private KB, DingTalk/Feishu, Office preview, stream actions, fs resources, variants, annotations, access IaC.
- **v0.54 RE tooling native** â€” REA, Ghidra, Craft native modules + expanded RE index (30+ entries, categories, online search).
- **v0.55 Preact web UI** â€” component-based chat, config modal, context meter, dark/light theme, Markdown/code/thinking blocks.
- **v0.56 aegisai-next parity** â€” swarm, patch, task, hunt, awesome-re, mcp-presets, vuln-patterns, markdown-memory, metrics.
- **v0.57 Final polish** â€” Tailwind CDN, pdf-parse, Windows installer, README rewrite, aegisai-next deprecated, repo public.
- **v0.58 TUI + LSP** â€” multi-pane terminal workbench + LSP client (hover, definition, completion, diagnostics, didOpen).
- **v0.59 Git-aware editing** â€” status, diff, commit, blame, branch, stash, log, show, reset, auto-commit.
- **v0.60 Multi-file diff review** â€” parseDiff, review, fullReview, stagedReview, unstagedReview, applyHunks.
- **v0.61 Provider breadth + marketplace** â€” 18 providers with auto-detection, plugin marketplace (search/install/uninstall/list).
- **v0.62 Interactive diff review** â€” startSession, acceptHunk/rejectHunk, acceptFile/rejectFile, navigation, renderCurrent, finish.
- **v0.63 Marketplace maturity** â€” categories, ratings, filters, enable/disable, update, info, stats, install from content/URL, dependency auto-install, featured catalog (8 plugins).
- **v0.64 Documentation & licensing** â€” MIT LICENSE, CONTRIBUTING.md, CHANGELOG.md, comprehensive README, updated llms.txt, HARNESS_DOCS.md.
- **v0.65 UX overhaul** â€” onboarding wizard, command palette (Ctrl+K), toast notifications, dashboard, help panel, keyboard shortcuts, empty/loading states.
- **v0.66 UX enhancements** â€” session sidebar, drag-and-drop file attach, tool execution timeline, responsive layout.


## Remaining / blocked

These items need native toolchains or a concrete integration need before they can be implemented:

- [x] Rust SDK / Rust runtime — toolchain installed via winget
- [x] Real ggml/llama.cpp in-process bindings — interface module (src/ggml-binding.js) and backend support (src/backends/index.js); native addon integration pending toolchain
- Real Windows UIAutomation wiring
- [x] MicroVM / K8s / eBPF sandboxing — core sandboxing infrastructure complete (sealed Docker, Podman, code sandboxing with rings & fingerprinting); remaining items need container orchestration / VM toolchain / eBPF kernel support
- Persistent shell state
- WASM sandbox
- Harness generator
- Admin panel
- Shared resource broker
- Multi-tenant isolation
- A2A/ACP protocol adapters (until a concrete integration need)
- In-process model loading (adapter interface only)

All other backlog items from prior milestones have corresponding src/*.js modules and tests and are considered implemented.

- **Current version:** v1.0.13
