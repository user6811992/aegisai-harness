# AegisAi Harness

[![CI](https://github.com/user6811992/aegisai-harness/actions/workflows/harness-check.yml/badge.svg)](https://github.com/user6811992/aegisai-harness/actions/workflows/harness-check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.13%2B-350333?logo=node.js&logoColor=white)](https://nodejs.org)
[![GitHub release](https://img.shields.io/github/v/release/user6811992/aegisai-harness)](https://github.com/user6811992/aegisai-harness/releases)
[![GitHub stars](https://img.shields.io/github/stars/user6811992/aegisai-harness)](https://github.com/user6811992/aegisai-harness/stargazers)

A **feature-rich, local-only AI agent harness** — OpenCode-class runtime, but
offline-first: no cloud dependencies, no telemetry. 85 milestones, 307 modules,
503 tests, CI green.

> Status: v1.0.32 (see [ROADMAP.md](./ROADMAP.md)).
> **Successor to [aegisai-next](https://github.com/user6811992/aegisai-next)** — that project is deprecated; all features have been ported here.
> **Live docs:** https://user6811992.github.io/aegisai-harness/

## What a harness is here

The harness is the runtime that hosts an agent loop around a local LLM:

- **Agent loop** with tool calls, streaming, fallback models, iteration caps, doom-loop detection, composable stop conditions.
- **Tool registry** with 64+ coding tools plus pluggable external tools (MCP, plugins, REA, Ghidra, Craft).
- **Capability-based security** (allowed/denied tool patterns per session, sandbox rings, clean room mode).
- **Session & memory persistence** in local SQLite with WAL (bi-temporal memory graph, hippocampus, source-bound memory).
- **Context management** (compaction + retrievable archive + capsules).
- **Local-only guarantees** (offline mode, local embeddings, no phone-home).
- **MCP client + server** (stdio + Streamable HTTP, conformance, Apps, Tasks, .mcpb, interceptors, uploads, skills).
- **Web UI** (Preact, Markdown rendering, context meter, dark/light theme, voice, config panel, onboarding wizard, command palette).
- **Terminal UI** (multi-pane TUI with status bar, chat, sidebar, command palette).
- **Reverse engineering** (REA, Ghidra, Craft, 30+ index, awesome-re 17k, pentest pipeline, vuln scanner, security KB).
- **Observability** (run capture, harness score, reliability attribution, OTel export, SARIF, Merkle ledger, evidence bundles).
- **Always-on layer** (events, timers, approvals, outbox, scheduler, cron, mailbox).
- **Multi-agent** (DAG orchestration, swarm, teams, multi-critic, task phases, async/background tools, Tauri group/broadcast IPC for parallel coordination).
- **Project scaffolding** (`aegisai --init` generates AGENTS.md, SOUL.md, TOOLS.md, MEMORY.md, PATH_RULES.md, MCP recommendations, plus Aegis governance blueprints).
- **Governance** (baseline-first, evidence-verified, drift-checked; verification gate before claiming completion; Aegis skill pack with 22 skills bundled).
- **Native Windows desktop shell** (Tauri v2: managed Node backend, system tray, governance status, group coordination, MSI/NSIS bundles).
- **Performance Dashboard 2.0** (unified model/tool/network latency view; DNS/TCP/TLS/server/transfer phases recorded locally).
- **Hardware-aware auto-tuning** (`--autotune`: DGX Spark GB10, Blackwell, Apple Silicon MLX, CUDA profiles → backend/quantization/context settings).
- **Unified model registry** (deduplicated model catalog bridging Ollama ↔ LM Studio and all other local providers).
- **Verification certificates** (signed, hash-verifiable completion certificates built on evidence bundles; optional Lean 4 formal check).
- **Optional research modules** (lazy discovery of mLattice, JIT LoRA, MIRAS, MoE predictor — never bundled).
- **Quality gates** (skill eval, harness lint, adversarial stress, comprehension benchmarks, convergence detection, CI template, conformance testing).
- **Git-aware editing** (status, diff, commit, blame, branch, stash, log, multi-file diff review, auto-commit).
- **Model providers** (18: Ollama, LM Studio, llama.cpp, vLLM, OpenAI, Anthropic, Groq, Mistral, DeepSeek, Together, Fireworks, Cohere, OpenRouter, Gemini, etc.).
- **Plugin marketplace** (search, install, uninstall, enable/disable, categories, ratings).
- **IM channels** (Telegram, Discord, DingTalk, Feishu).
- **LSP integration** (hover, definition, completion, diagnostics).

## Quick start

```bash
git clone https://github.com/user6811992/aegisai-harness.git
cd aegisai-harness
git submodule update --init --recursive   # bundles the Aegis skill pack (22 skills)
npm install
npm start
```

> Source installs need the submodule init step for the bundled Aegis skill pack.
> The Windows/macOS installers bundle these files already, so no submodule step is needed there.

Requires **Node.js 22.13+** (`node -v` to check) and a local backend (Ollama recommended). The Windows installer does **not** bundle Node.js — install the LTS from [nodejs.org](https://nodejs.org) first and reopen your terminal so `node` is on PATH.

### Scaffold your own project

Run `aegisai --init` in any project directory to generate agent-ready scaffolding:

```bash
cd /path/to/your/project
aegisai --init
# Creates: AGENTS.md, SOUL.md, TOOLS.md, MEMORY.md, PATH_RULES.md,
#          MCP_RECOMMENDATIONS.json, .mcp.json, .aegisai/project.json
```

The command auto-detects the project type (Node, Python, Rust, Go, Java, .NET, generic) and writes a matching test command, lint command, MCP server recommendations, and forbidden-path rules.

### Web UI

```bash
npm start -- --web
# Open http://127.0.0.1:8080
```

### Split GGUF models

Some GGUF models ship as multiple shards, for example:

```text
model-00001-of-00002.gguf
model-00002-of-00002.gguf
```

Point llama.cpp at the **first shard**; it loads the remaining shards automatically:

```bash
llama-server -m /models/model-00001-of-00002.gguf --host 127.0.0.1 --port 8081
```

The harness groups the shards into one entry in **Settings — Discover** and marks it `[gguf split 1/2]`. Do not select the `00002` shard directly. If you need a single file for Ollama, merge the shards first with `llama-gguf-split --merge`.

### Terminal UI

```bash
npm start -- --tui
```

### MCP server (for Claude Code, Cursor, etc.)

```bash
npm start -- --mcp-server
# Connect to http://127.0.0.1:3001/mcp
```

### Headless / CI

```bash
node src/index.js --json "your prompt here"
```

## Build

```bash
# Windows installer (requires Inno Setup 6)
.\packaging\build.ps1 -Installer

# Standalone binary
.\packaging\build.ps1 -Binary

# Or use the cross-platform binary script
bash packaging/build-binary.sh

# Native Windows desktop app (MSI / NSIS, requires Rust + Tauri CLI)
cd packaging/tauri && cargo tauri build
```

The Tauri desktop shell wraps the web UI in a WebView2 window and manages the
Node backend automatically (system tray with Show / Restart backend / Quit).
See [packaging/tauri/README.md](./packaging/tauri/README.md) for details.

CI enforces `node scripts/check-version-consistency.js` so `package.json`, the installer filename, docs, and release tag always agree. Release assets include a `.sha256` checksum file — verify it before running an installer:

```bash
# PowerShell (in the download folder)
Get-FileHash .\AegisAi-Harness-1.0.32-Setup.exe -Algorithm SHA256
```

## Environment variables

Key ones:

| Var | Purpose | Default |
|---|---|---|
| `PORT` / `HOST` | Bind address | 127.0.0.1:8080 |
| `AEGISAI_TOKEN` | Auth token (open mode if unset) | (none) |
| `AEGISAI_OFFLINE` | Force offline mode | false |
| `BACKEND_TYPE` | Backend type (auto/ollama/openai) | auto |
| `BACKEND_URL` | Backend URL | auto-detect |
| `AEGISAI_DATA_DIR` | Data directory | ./data |
| `AEGISAI_PROJECT_ROOT_ALLOWLIST` | Allow-list for agent project roots | (none) |
| `AEGISAI_WEB_AUTO_APPROVE` | Allow the web UI to auto-approve tool calls (off by default) | false |

## Troubleshooting

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for full details. Quick fixes:

- **`.js` files open in Notepad / `node` is not recognized** — Node.js isn't installed or isn't on PATH. Install Node 22.13+ LTS from https://nodejs.org, reopen the terminal, verify `node -v`, then reinstall/retry. Double-clicking a `.js` file is not how the harness starts.
- **Stale version after uninstalling** — the old runtime `node_modules` survives an Inno uninstall in older builds. Delete `%LOCALAPPDATA%\Programs\AegisAiHarness` (or `%LOCALAPPDATA%\AegisAiHarness`) before reinstalling. For npm: `npm uninstall -g aegisai-harness && npm cache clean --force`.
- **Web UI is blank offline** — v0.68.0 vendors Preact/Tailwind locally; clear the browser cache if an older service worker is still serving stale assets.
- **Web chat sends empty prompts** — fixed in v0.68.0; the browser now posts `message`, matching the server API.

## Layout

```
src/              320+ modules (agent, tools, backends, storage, integrations, ...)
public/           web UI (Preact + Tailwind vendored locally, no build step)
tests/            503 tests (node:test)
packaging/        Windows/macOS/Linux installers + binary build
docs/             landing page, setup guides, future integrations matrix
vendor/aegis      Aegis Method Pack (git submodule, 22 skills)
```

## Future & Research Integrations

The harness stays **local-only**. Heavier or network-dependent features are opt-in
and never bundled. Research-grade ideas that are tracked but not yet implemented:

| Area | Idea | Source | Status |
|---|---|---|---|
| Long context | mLattice linear-memory kernel | eelbaz/mLattice | Planned (needs PyTorch/CUDA) |
| Continuous learning | JIT LoRA weight updates | eelbaz/jit-lora | Policy adapted; full training planned |
| Memory | MIRAS / Titans neural memory | eelbaz/olmo3-miras | Scoring policy adapted; neural module planned |
| MoE throughput | Expert prefetch predictor | eelbaz/tensorbend-predictor | Planned (needs vLLM/ggml) |
| Multi-agent transport | p2p pubsub over QUIC | eelbaz/peerhive | Planned |
| Self-improvement | Loop-dynamics weight editing | Recursive-Self-Improving-Loopers | Convergence detection adapted |
| Trust | Ed25519-signed certificates | — | Planned (currently content-hash only) |
| UX | Dashboard Web UI panel | — | Planned (data layer ready) |

See [docs/FUTURE_INTEGRATIONS.md](./docs/FUTURE_INTEGRATIONS.md) for the full
detail matrix, feasibility ratings, and decision principles. Planned items are
**not committed** — the roadmap is edited as work lands.

## License

MIT

## Acknowledgments

Built with inspiration from the open-source community.

### Prior art & inspiration
- **Agent harnesses** — OpenCode, Claude Code, Aider, Cline, OpenHands, Goose, Codex, DeerFlow, Symphony, diggerhq
- **MCP** — Model Context Protocol (modelcontextprotocol/servers, registry, extensions)
- **Reverse engineering** — REA, Ghidra, Craft Anything, awesome-reverse-engineered, netvein
- **Memory & learning** — bytedance/deer-flow, volcengine/OpenViking, rohitg00/agentmemory
- **Security & governance** — Microsoft agent-governance-toolkit, spec-kitty, GanyuanRan/Aegis
- **Observability** — OpenTelemetry, SARIF, LangSmith, Langfuse
- **Scaffolding & coordination** — harnessforge, apiad/aegis, linkdigest-mcp
- **Local inference research (@eelbaz)** — mLattice, JIT LoRA, olmo3-miras, Recursive-Self-Improving-Loopers, lyra, ollama-lmstudio-bridge, dgx-spark-vllm-setup, cdnshare, tensorbend-predictor, Rule30PrizeKit, peerhive

All adapted patterns are attributed in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
