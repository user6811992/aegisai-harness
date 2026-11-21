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

## v0.11 — Packaging (done)
- [x] Build script (packaging/build.ps1)
- [x] Install script (packaging/install.ps1)
- [x] Offline update checker (src/updater.js, --update, /update)
- [x] Web UI (public/index.html) + --web mode
- [x] Tauri desktop scaffold (packaging/tauri/)
- [ ] Offline auto-update download — deferred
- [ ] Accessibility & theming — deferred

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

## v0.10 — From ecosystem exploration (NousResearch, deepseek-ai, fendouai, opencode-ai)
### From NousResearch/hermes-agent
- [ ] Skill auto-creation from experience + self-improvement during use
- [ ] Periodic nudges to persist knowledge
- [ ] Session search with LLM summarization (cross-session recall)
- [ ] Pluggable memory providers (mem0, honcho, supermemory, openviking)
- [ ] Pluggable terminal/sandbox backends (Docker, SSH, Modal, Daytona)
- [ ] Cron scheduling with platform delivery
- [ ] Context files (project context shaping every conversation)
- [ ] Agent import/migration from other agents (OpenClaw, Claude Code, Codex, Cursor)
- [ ] Honcho dialectic user modeling (already have Honcho skill)
### From NousResearch/agent-governance-toolkit (Microsoft)
- [ ] Policy engine (YAML/OPA/Rego/Cedar) evaluated before execution
- [ ] Zero-trust identity (Ed25519, trust scoring)
- [ ] Execution sandboxing (4-tier privilege rings, saga orchestration, kill switch)
- [ ] Agent SRE (SLOs, error budgets, chaos engineering, replay debugging)
- [ ] MCP security scanner (tool poisoning, typosquatting, hidden instructions)
- [ ] Shadow AI discovery (find unregistered agents)
- [ ] Agent lifecycle (provisioning, credential rotation, orphan detection, decommissioning)
- [ ] Governance dashboard
### From deepseek-ai/deepseek-harness
- [ ] Event-driven plugin architecture (Cordis-style spatiotemporal composability)
- [ ] Web UI at localhost
- [ ] Plugin discoverability via topic tags
### From fendouai/PrivateSecretary
- [ ] Multimodal context capture (screen/audio OCR/ASR) as optional integration
- [ ] Read-only memory timeline + contacts/messages aggregation
- [ ] Significant consolidation + cold archive (memory compaction enhancement)
- [ ] Read-only boundary enforcement (formalize read-only mode)
### From opencode-ai/opencode
- [ ] Richer TUI patterns (multiline editing, slash-command autocomplete)

## v0.12 — From second ecosystem exploration (RyanAlberts, earendil-works, aaif-goose, cline, OpenHands)
### From earendil-works/pi
- [ ] TUI library with differential rendering (pi-tui)
- [ ] Prompt templates (reusable prompt snippets)
- [ ] Themes (terminal theming)
- [ ] Extension packages (npm/git-based) with hot reload
- [ ] RPC mode (control harness over RPC)
- [ ] Durable runtime (pi-durable: conversations, tasks, documents)
- [ ] Agent core as reusable library (pi-agent-core)
- [ ] MicroVM sandboxing (gondolin) — Linux micro-VM with TS control plane
- [ ] Durable JS execution (dquickts: suspend/snapshot/resume JS)
- [ ] Sandboxed shell (psh: bash in a box)
### From aaif-goose/goose
- [ ] Agent Client Protocol (ACP) — integrate harness as backend for apps
- [ ] In-process model loading (no separate inference server)
- [ ] State machine architecture (operation-based)
- [ ] Custom distributions (preconfigured providers/extensions/branding)
- [ ] oi-kit Rust runtime (for native performance)
### From cline/cline
- [ ] Plan and Act modes (explore/plan then execute)
- [ ] Multi-agent teams (coordinator + specialists)
- [ ] Scheduled agents (cron-based recurring runs)
- [ ] Messaging platform integration (Slack/Telegram/Discord/WhatsApp)
- [ ] Headless CLI for CI/CD (JSON output, piping)
- [ ] MCP marketplace (discover/install MCP servers)
- [ ] SDK for building custom agents
- [ ] Real-world coding benchmarks (cline-bench)
- [ ] Semantic repository search (kamibiki)
### From OpenHands
- [ ] Self-hosted control center (web UI for agents)
- [ ] Modular SDK (software-agent-sdk)
- [ ] Sandbox server (hosted sandboxes)
- [ ] Evaluation harness (benchmarks)
- [ ] Binary CLI packaging (OpenHands-CLI)
- [ ] Extension registry
- [ ] Automation service (scheduling + webhooks)
- [ ] Trajectory visualization
- [ ] Agentic code search (codescout)
### From RyanAlberts
- [ ] Harness comparison/positioning (best-of-Agent-Harnesses catalog)
- [ ] MCP Apps protocol (UIs embedded in chatbots via MCP)
- [ ] Persistent decision memory (agentlog — Karpathy LLM Wiki productized)
- [ ] Opinionated tool sets (gstack-style role-based tools)
- [ ] Windows/FS robustness (from claude-code-issues-analyzer findings)

## v0.13 — Deepened findings from second exploration
### From RyanAlberts/best-of-Agent-Harnesses (187-harness catalog)
- [ ] Progressive tool discovery — retrieve tools by requirement instead of stuffing schemas (MCP-Zero/ToolRAG pattern)
- [ ] Content-aware tool output compression before model (Headroom pattern, ~20-60% fewer tokens)
- [ ] Tool-output sandboxing + cross-platform session memory (context-mode pattern)
- [ ] Harness self-audit skills: guardrail tester, runaway guard, sandbox-check, claim-check, session-waste-report
- [ ] Minimal-harness template + build-your-own playbook (docs)
- [ ] Machine-readable catalog: llms.txt + JSON for agent consumption
- [ ] Explicit autonomy/recovery tiers (step-gated → headless; none → durable)
- [ ] Agent-computer interface (ACI) design notes
- [ ] Model×harness pairing evals (rankings don't transfer across models)
### From RyanAlberts/agentlog
- [ ] Decision memory — remember/recall/reflect over JSONL (LLM does heavy lifting, no vector DB)
- [ ] Reflect: find patterns, contradictions, gaps across decision history
### From cline/kanban
- [ ] Parallel task board with ephemeral worktree per task
- [ ] Task dependency chains + auto-commit
- [ ] Hooks to display latest message/tool per task
- [ ] Checkpointing + diff review + line comments
- [ ] Script shortcuts (e.g. npm run dev) + embedded git interface
### From earendil-works/pi (deeper)
- [ ] Differential TUI rendering
- [ ] Unified multi-provider LLM API (pi-ai)
- [ ] Embeddable agent core library (pi-agent-core)

## v0.14 — From third ecosystem exploration (Aider-AI, openai, QwenLM) (in progress)
### From Aider-AI/aider
- [x] Repo map (symbols + imports) — get_repo_map tool
- [ ] AST-aware code search (grep-ast pattern) — deferred
- [ ] Convention files (aider conventions / AGENTS.md-style) — deferred
- [ ] Polyglot + refactoring benchmarks — deferred
- [ ] SWE-bench harness integration — deferred
### From openai
- [x] Multi-agent handoffs (handoff_to_agent) + guardrails + tracing
- [x] Input/output guardrails (src/guardrails.js)
- [x] Machine-readable catalog (llms.txt)
- [ ] Secure MCP tunnel for local/private MCP servers — deferred
- [ ] MCP extensions (native-feeling plugins) — deferred
- [ ] Skills catalog for Codex — deferred
- [ ] Isolated autonomous implementation runs (symphony) — deferred
- [ ] VM-based sandboxing (tart/orchard/softnet, fence) — deferred
- [x] Token counting (src/tokenizer.js)
- [ ] Frontier evals — deferred
- [ ] Model Spec (behavior specification) — deferred
### From QwenLM
- [ ] Multimodal realtime harness (Qwen-Live-Harness — see/hear/act + memory)
- [ ] Multimodal-native plugins (Qwen-MM-Plugins)
- [ ] Computer-use via accessibility APIs (open-computer-use)
- [ ] Agent framework (Function Calling, MCP, Code Interpreter, RAG — Qwen-Agent)
- [ ] Verifiable environments for computer-use agents (RecreationWorld)
- [ ] Long-horizon benchmarks (E-CommerceBench)
- [ ] Local ASR/TTS models (Qwen3-ASR/TTS) for capture
- [ ] Simulated browser for web agents (WebWorld)

## v0.15 — From own repos (aegisai-next, MyTunesReduxReborn, LocalAI)
### From aegisai-next (web UI / infra patterns to port to harness)
- [ ] Conversation branching (fork chat at any message point)
- [ ] PWA: installable + service worker + safe-area/mobile-friendly
- [ ] Voice: STT (mic) + TTS (speaker) via Web Speech API
- [ ] Pending-actions UI (human-in-the-loop approve/reject in web UI)
- [ ] Model management UI (pull models, scan drives for GGUF/Ollama stores)
- [ ] Runtime backend switcher (change backend type/URL from UI)
- [ ] Integration status panel + install buttons (REA/Ghidra/Craft)
- [ ] Skills + memory panels in web UI (add/delete/run; add/delete/RAG reindex)
- [ ] Version checking UI (harness, Node, Ollama)
- [ ] Error log viewer
- [ ] Full backup export/import as JSON (already have CLI backup)
- [ ] Auth token + rate limiting (LOCALAI_TOKEN/AEGISAI_TOKEN, rate limit)
- [ ] Project root allowlist
- [ ] Docker + docker-compose
- [ ] Cross-platform installers (Inno Setup Windows, DMG macOS, AppImage Linux)
- [ ] Real REA/Ghidra/Craft tool wiring (currently "external tool not wired" stubs)
### From MyTunesReduxReborn
- [ ] Standalone Windows executable with no Node install
- [ ] Dark/light theme toggle
- [ ] Connection profiles (pattern for MCP/backend profiles)
- [ ] mDNS/Bonjour discovery pattern (for local MCP/backend discovery)
### From LocalAI
- [ ] (predecessor — superseded by aegisai-next, no new items)

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
