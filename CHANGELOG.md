# Changelog

All notable changes to AegisAi Harness are documented here.

## [1.0.6] - 2026-11-26

### Fixed
- Chat: deterministic commands respond as SSE when stream:true; backend alias normalization and validation.

## [1.0.5] - 2026-11-26

### Fixed
- Backend: normalize aliases (llama.cpp, llama-cpp, etc.) in chat commands, /api/backend, and /api/config; validate supported types.

## [1.0.4] - 2026-11-26

### Fixed
- Chat: strip chat-template special tokens from streamed and final replies; buffer partial tokens across chunks.

## [1.0.3] - 2026-11-26

### Added
- Model discovery: detect and group split GGUF shards into a single model entry.

## [1.0.2] - 2026-11-26

### Fixed
- Web UI: restored stylesheet link and theme selectors; removed duplicate Performance Dashboard; conversation search highlighting; context meter and export use current session; default session history no longer reused silently.
- Agent: `get_time` and structured tools return previews with `ok`; small-talk/identity guards prevent spurious tool calls; web chat deterministic backend/model commands and system prompt.
- Backends: OpenAI-compatible backends now receive tool definitions; backend type switch uses default URLs and persists; `/api/config` activates the selected backend.
- Markdown: placeholder restore uses exact nonces; inline code in table cells renders; math with pipes stays in one cell.
- Scheduled tasks: cron evaluation honors day/month/weekday and scans 5 years for leap days.
- Security: snippet delete rejects traversal ids; session import validates id/title/tags/overwrite.
- Test isolation: `npm test` no longer overwrites real `data/`.

## [1.0.1] - 2026-11-25

### Fixed
- Installation: Windows installer now preflights Node.js 22.13+ with actionable messages; launcher no longer hides npm failures, uses `--omit=dev`, and records a dependency marker. Inno uninstall removes stale `node_modules`/lockfiles; `install.ps1` preserves `data/` and handles GitHub source zips.
- Packaging: `package.json` is the single version source; CI checks version strings across installer/docs/changelog. Release workflow honors its `tag` input, derives versions from the tag, refuses mismatches, and publishes SHA-256 checksums. Standalone binary builds use pkg 6 + Node 24 targets and `--out-path` (pkg 5/node22 produced broken binaries).
- Web UI: chat now posts `message` (server API field), onboarding actually applies the chosen model and auth token, token auth is read per request with a constant-time comparison, and tool auto-approval from the browser is opt-in (`AEGISAI_WEB_AUTO_APPROVE`).
- TUI: fixed a temporal-dead-zone `root` reference that made `node src/index.js --tui` crash immediately.
- Offline: Preact/htm/Tailwind are vendored under `public/vendor/`; service worker is registered, versioned, and caches all UI assets.
- Security: static file serving rejects `../` and encoded traversal paths; new `src/http_utils.js` helper with tests.
- npm global installs: added a shebang and a `preinstall` Node version guard so `npm i -g` fails clearly on unsupported runtimes instead of leaving a broken CLI.

### Added
- `scripts/check-version-consistency.js`, `scripts/check-node.js`, `docs/TROUBLESHOOTING.md`, and regression tests for entry points, web auth, path traversal, and UI wiring.

## [0.64.0] - 2026-11-21 through 2026-11-25

See ROADMAP.md and git history for per-version detail (v0.64–v0.85). Highlights:

- v0.64–v0.66: UX overhaul and enhancements (onboarding wizard, command palette, toast notifications, dashboard, help panel, keyboard shortcuts, session sidebar, drag-and-drop, tool timeline, responsive layout). 59 issues closed.
- v0.67: publishing setup (npm OIDC trusted publishing, Docker/GHCR, Pages, Discussions, wiki, AirLLM provider, ledger seq-collision fix, installer version fix, --version flag).
- v0.68–v0.74: web UI overhaul (Preact, vendored deps, CORS, auto-start Ollama, model management, streaming chat, conversation export, multi-model comparison, file browser, conversation search, themes, keyboard shortcuts, auto-update).
- v0.75–v0.77: issue fixes (#60–#90), batch 1 & 2 UX (file browser, conversation search, themes, split editor, attachment chips, session tags).
- v0.78–v0.80: issue fixes (#85–#94), batch 3 (model probes, skill scanner, verified secret scanning, audit pipeline, MCP inspector, nuclei templates, crawler, remediation, doc conversion, handoff, conversation templates, A/B testing, browser vision tools).
- v0.81–v0.85: batch 4 & 5 (http probe, pentest eval, tiny router, deck PDF, skill schema, architecture map, guardrail API, IoC import, synthetic logs, Teams/Mattermost, agent CLI adapters, package guard, LSP rename, multi-model A/B, malware scan, i18n, skills catalog, a11y/PWA), plus issue fixes (#95–#99).

## [0.63.0] - 2026-11-22

### Added
- Plugin marketplace maturity: categories, ratings, tags, filters, enable/disable, update, info, stats
- Install from content/URL with dependency auto-install
- 8 curated featured plugins

## [0.62.0] - 2026-11-22

### Added
- Interactive multi-file diff review UI (accept/reject hunks per file)

## [0.61.0] - 2026-11-22

### Added
- Model provider breadth: 18 providers (Ollama, LM Studio, llama.cpp, vLLM, text-gen-webui, KoboldCpp, LocalAI, Jan, OpenAI, Anthropic, Groq, Mistral, DeepSeek, Together, Fireworks, Cohere, OpenRouter, Gemini) with auto-detection
- Plugin marketplace (search, install, uninstall, list)

## [0.60.0] - 2026-11-22

### Added
- Multi-file diff review (parseDiff, review, fullReview, stagedReview, unstagedReview, applyHunks)

## [0.59.0] - 2026-11-22

### Added
- Git-aware editing: status, diff, commit, blame, branch, stash, log, show, reset, auto-commit
- `--auto-commit` flag

## [0.58.0] - 2026-11-22

### Added
- Multi-pane TUI (status bar, chat, sidebar, command palette)
- LSP client (hover, definition, completion, diagnostics, didOpen)
- `--tui` flag

## [0.57.0] - 2026-11-22

### Added
- Tailwind CSS via CDN
- pdf-parse support in office preview
- Proper Windows installer (Inno Setup)
- README rewrite
- aegisai-next deprecated
- Repository made public

## [0.56.0] - 2026-11-22

### Added
- Swarm orchestration, dependency patch proposals, phase-based tasks
- Bug-hunting flow, awesome-re 17k index, MCP presets
- Vuln-patterns library, markdown memory, metrics

## [0.55.0] - 2026-11-22

### Added
- Preact web UI (via CDN, zero npm deps)

## [0.54.0] - 2026-11-22

### Added
- Native RE tooling (REA, Ghidra, Craft modules)
- Expanded RE index (30+ entries, categories, online search)

## [0.53.0] - 2026-11-22

### Added
- Private knowledge base, DingTalk/Feishu channels, Office preview
- PAT-gated stream actions, filesystem MCP resources
- Tool variants, tool annotations, access management IaC

## [0.52.0] - 2026-11-22

### Added
- IM channel adapters (Telegram, Discord)
- GitHub webhook event-driven agents
- File attachments, graph memory via MCP

## [0.51.0] - 2026-11-22

### Added
- Projects with instructions + document shelf
- Hippocampus memory, skill factory, UI replay, embedded Python client

## [0.50.0] - 2026-11-22

### Added
- Session goals, personal access tokens, token dashboard
- Proof-of-work artifacts, Codex-style approval modes

## [0.49.0] - 2026-11-22

### Added
- Roadmap from deer-flow, symphony, codex exploration

## [0.48.0] - 2026-11-22

### Added
- MCP protocol extensions (conformance, Apps, Tasks, .mcpb, interceptors, uploads, skills)

## [0.47.0] - 2026-11-22

### Added
- Streamable HTTP MCP server mode
- MCP reference servers (sequential thinking, fetch_url, time, registry browser, Everything fixture)

## [0.46.0] - 2026-11-22

### Added
- MCP reference servers from modelcontextprotocol/servers

## [0.45.0] - 2026-11-22

### Added
- Full app parity (keyless engines, simulated approval, citations, netvein, vision, proxy abort, RE index, AST chunking, remote docs)

## [0.44.0] - 2026-11-22

### Added
- App-parity gaps (rich chat UI, memory RAG, model discovery, lenient parsing, SSRF guard, context meter, UI config, default skills, squeeze)

## [0.43.0] - 2026-11-22

### Added
- Reliability & verification (session briefs, deterministic compaction, error recovery, chaos, silent-failure, honesty, boundary bench, replay guard, MCP pinning, Merkle, readiness, trajectory UI, cost routing, tool contracts, agents-as-tools, equipment registry)

## [0.42.0] - 2026-11-22

### Added
- Roadmap from harness tools search pages 5-8

## [0.41.0] - 2026-11-22

### Added
- Tool systems & evidence (tool state/eval, evolution search, config matrix, migration recipes, confidence memory, event replay, context reset, identity audit, 5-layer spans, evidence bundles, composable APIs)

## [0.40.0] - 2026-11-22

### Added
- Roadmap from harness tools search pages 1-4

## [0.39.0] - 2026-11-22

### Added
- Clear remaining deferred (simulated browser, plugin UI, 5-layer security, layer registry, markdown governance, trace export, native adapters)

## [0.38.0] - 2026-11-22

### Added
- DiggerHQ integrations (Slack gateway, WS bridge, serverless, Podman, PR review, CI resolver, CVE reachability)

## [0.37.0] - 2026-11-22

### Added
- DiggerHQ patterns (brain/sandbox, health failover, git state, bug repro, maintenance templates, speed bench, runtime contract, sandbox fingerprint)

## [0.36.0] - 2026-11-22

### Added
- Roadmap from diggerhq with feasibility ratings

## [0.35.0] - 2026-11-22

### Added
- Decisions & interop (decision gates, workflow state machine, two-bar goals, geometric memory, session converter, arch rules, AIBOM, SSH bridge)

## [0.34.0] - 2026-11-22

### Added
- Retrieval & reporting (semantic tools, YAML evals, pass@k, failure clusters, ledger rewind, Gems, AHP gateway, SARIF)

## [0.33.0] - 2026-11-22

### Added
- Interfaces & governance (dual-graph memory, constitution, BiDi, SSE, config installer, multi-search, routing eval, control plane)

## [0.32.0] - 2026-11-22

### Added
- Memory & control (graph memory, UI replay, executor/verifier separation, self-writing policy, debugger, cheapest-model finder, code-flow map)

## [0.31.0] - 2026-11-22

### Added
- Protocol & isolation (A2A, DAG editor UI, local voice, sealed Docker, multi-tenant)

## [0.30.0] - 2026-11-22

### Added
- P2 platform (task board, context FS, event bus, ACP, benchmarks, docs, pentest pipeline)

## [0.29.0] - 2026-11-22

### Added
- Security & local inference (hardware detect, gateway, admission, vuln scanner, security KB, deep research, continual, memory hierarchy)

## [0.28.0] - 2026-11-22

### Added
- Ecosystem & tooling (runtime manager, shadow AI, skill packages, MCP marketplace, self-improvement, templates/themes/RPC, harness-as-code, config discovery)

## [0.27.0] - 2026-11-22

### Added
- Context & control (AX browser, capsules, rollback, task state, web search, slop filter, peer review)

## [0.26.0] - 2026-11-22

### Added
- Audit & evolution (ledger, action guardrails, counterfactual evolution, file-first verification, waste detection, mailbox)

## [0.25.0] - 2026-11-22

### Added
- Trust & governance (lifecycle, PII, charter, Windows robustness, pairing evals, bi-temporal memory)

## [0.24.0] - 2026-11-22

### Added
- Teams & interfaces (teams, JSON CLI, context files, read-only, markdown extract)

## [0.23.0] - 2026-11-22

### Added
- Trust & tuning (MCP security scanner, source-bound memory, contract baselines, optimizer, cron)

## [0.22.0] - 2026-11-22

### Added
- Roadmap from harness search pages 4-6

## [0.21.0] - 2026-11-22

### Added
- Computer use (CDP browser tools)

## [0.20.0] - 2026-11-22

### Added
- DAG orchestration + multi-critic evaluation pipeline

## [0.19.0] - 2026-11-22

### Added
- Voice input/output (Web Speech API)

## [0.18.0] - 2026-11-22

### Added
- Run capture, harness score, reliability attribution

## [0.17.0] - 2026-11-22

### Added
- Roadmap from GitHub harness search

## [0.16.0] - 2026-11-22

### Added
- Integration/skills/memory panels, version/errors/backup UI, Docker, RE wiring, allowlist

## [0.15.0] - 2026-11-22

### Added
- Web UI branching, approval, model mgmt, PWA, auth/rate limit, installers

## [0.14.0] - 2026-11-22

### Added
- Integration/skills/memory panels, version/error-log/backup UI

## [0.13.0] - 2026-11-22

### Added
- Ecosystem exploration 2 items

## [0.12.0] - 2026-11-22

### Added
- Ecosystem exploration 1 items

## [0.11.0] - 2026-11-22

### Added
- Packaging (build script, install script, offline update checker)

## [0.10.0] - 2026-11-22

### Added
- Policy engine, sandbox rings, skill auto-create, session search, capture, observability

## [0.9.0] - 2026-11-22

### Added
- Async/background tools, state-diff grading, large-tool-set stress, advanced routing, TOML config, benchmark suites

## [0.8.0] - 2026-11-22

### Added
- Tool sets, SKILL.md import, proxy mode

## [0.7.0] - 2026-11-22

### Added
- Enhanced doom-loop, richer hooks, tool context, format converters, OTel export

## [0.6.0] - 2026-11-22

### Added
- Richer hooks, enhanced doom-loop, state-diff grading, advanced routing, conversation state accessor

## [0.5.0] - 2026-11-22

### Added
- Doom-loop detection, composable stop conditions, mock MCP services, tool-payload stress testing, multi-backend router

## [0.1.0] - 2026-11-22

### Added
- Initial harness scaffold: agent loop, tool registry, backends, storage, MCP client, compaction, hooks, tracing, eval, vault, backup, proxy, web UI
```
