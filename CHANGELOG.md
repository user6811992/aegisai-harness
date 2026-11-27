# Changelog

All notable changes to AegisAi Harness are documented here.

## [1.0.18] - 2026-11-27

### Fixed
- Fixed the v1.0.17 Tauri config (removed invalid NSIS `artifactName`) and Rust compile errors: command macros are now non-public, tray icon uses the configured app icon, and `spawn_backend` receives `AppHandle`. `cargo check` now passes cleanly.
- Issue #189: Performance Dashboard reported zero tokens for llama.cpp and zero built-in tool calls. OpenAI-compatible streaming requests now set `stream_options: { include_usage: true }`; `profiler.recordTool` is now called for every tool (built-in, coding, and cached). Added `tests/v1018_fixes.test.js` regression coverage.

### Verification
- 361 tests pass, 0 failures. `cargo check` exit code 0. Version consistency ok.

## [1.0.17] - 2026-11-27

### Added
- **Native Windows desktop shell (Tauri v2)**: `packaging/tauri/` now builds real MSI/NSIS installers. The Rust shell manages the Node backend (start/stop/restart), provides a system tray (show, restart backend, quit), and exposes IPC commands (`backend_status`, `backend_start`, `backend_stop`, `backend_restart`) to the localhost-origin WebView.
- Bundled harness resources (`src`, `public`, `scripts`, docs, LICENSE) into the Tauri installers; added Windows icons (`.ico`), capability permissions, and a Tauri README.
- Release workflow now builds Tauri bundles on `windows-latest` and attaches them to the GitHub release.

## [1.0.16] - 2026-11-26

### Security
- Fixed PowerShell command injection in `src/native_adapters.js` `windowsRPA.click()` by passing selector data as base64-encoded JSON instead of interpolating raw strings.
- Fixed SQL injection via column names in `src/backup.js` backup import by validating columns against `PRAGMA table_info`.
- Added tenant/session identifier validation in `src/tenants.js` to prevent path traversal.
- Fixed double-response bug on invalid tags in `src/index.js` (return inside forEach callback).
- Switched Docker/Compose web binding to `0.0.0.0` inside the container so published ports are reachable; bound Ollama to loopback only.
- Removed the GitHub PAT from the local git remote URL.

### Fixed
- Fixed `r is not defined` in `src/tenants.js` `checkQuota()` (all tenant tool-access checks previously threw).
- Fixed non-streaming OpenAI-compatible backend responses being parsed as SSE (silently empty content in compaction, memory, critic, peer review).
- Fixed `v052` test failure: `data` used before declaration in `src/agent/run.js`; also corrected token-count operator precedence.
- Fixed denied tool results missing `tool_call_id`, which broke follow-up model turns after approval denial.
- Fixed resource broker leases not being restored from disk; `isLocked()` now ignores expired locks.
- Fixed persistent shell `exec()` returning partial output after a fixed 200ms; now uses a completion sentinel with timeout fallback.
- Fixed REPL `/export` always exporting an empty conversation (dead code in `src/index.js`).
- Fixed agent compaction dropping removed messages from the archive.
- Fixed code sandbox temp-file collisions by using `mkdtempSync`; `isAvailable()` now reflects real runnable state.
- Added missing `src/harness_generator.js`, `harness_spec_schema.yaml`, `harness_spec_template.yaml` referenced by the roadmap (generator also had missing `fs`/`path` requires).

### Documentation & Packaging
- Corrected mojibake and stale version/test-count data across README, ROADMAP, CHANGELOG, docs pages, and issue templates.
- Balanced unmatched Markdown code fences in README, CHANGELOG, llms.txt, and CONTRIBUTING.
- Added `THIRD_PARTY_NOTICES.md`; shipped LICENSE + notices + `scripts/` in Windows/Linux/macOS installers (first-run `npm install` was broken without `scripts/`).
- Added Tauri `build.rs`, fixed Tauri versions/icons, added `.dockerignore`, Docker healthcheck and non-root user.
- Hardened CI: env-var indirection in release workflow (script injection), unconditional tag/version checks in npm and Docker workflows, version checker now covers Tauri files and semver prereleases.

### Issues resolved
- Issue #187 (v1.0.14 chat TDZ crash) — fixed in commit c35497b; regression test added via PR #188.

### Verification
- All 359 tests pass (358 pass, 1 skipped, 0 failures), including PR #188 regression test for issue #187.
- Version consistency check passes for v1.0.16.

## [1.0.15] - 2026-11-26

### Fixed
- Removed stray UTF-16 test output artifacts (test_final.txt, test_run.txt, testrun*.txt) from git tracking; added ignore rules so local test logs are never committed again.
- Cleaned literal mojibake text from the v1.0.14 CHANGELOG entry.

## [1.0.14] - 2026-11-26

### Fixed
- Corrected mojibake/encoding corruption in ROADMAP.md and README.md (em dashes rendered as corrupted character sequences).
- Updated stale documentation: README test count (257 -> 358), shipped-version range, and "Remaining / blocked" section now reflects all items complete.

## [1.0.13] - 2026-11-26

### Fixed
- Restored test compatibility in `src/persistent_shell.js`: `start()` now defaults the session ID to `'default'` so `ps.start()` / `ps.isRunning()` work when no session ID is supplied (commit 883113d).
- Stopped tracking runtime state (`.aegisai/a2a-broker/state.json`); added `.aegisai/` to `.gitignore` so runtime/session state is never committed.

## [1.0.12] - 2026-11-26

### Fixed
- Issue #184: v1.0.11 does not include fix commit; 10 issues still reproduce in fresh install.
- Resolved: version tag mismatch; all validations from v1.0.11 now present on main.

## [1.0.11] - 2026-11-26

### Added
- Tor/proxy support for web requests via AEGISAI_TOR_PROXY/TOR_PROXY (curl-backed, SOCKS/HTTP).
- Persistent shell session module (src/persistent_shell.js) for stateful command execution.

## [1.0.8] - 2026-11-26

### Added
- Search engines: Startpage and Firecrawl support added to web_search/multi_search.

## [1.0.7] - 2026-11-26

### Added
- Web search: pluggable engines (DuckDuckGo, Brave, Searx) selectable via AEGISAI_SEARCH_ENGINE or env keys; multi_search includes configured engines.

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
