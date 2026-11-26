# AegisAi Harness

[![CI](https://github.com/user6811992/aegisai-harness/actions/workflows/harness-check.yml/badge.svg)](https://github.com/user6811992/aegisai-harness/actions/workflows/harness-check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.13%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![GitHub release](https://img.shields.io/github/v/release/user6811992/aegisai-harness)](https://github.com/user6811992/aegisai-harness/releases)
[![GitHub stars](https://img.shields.io/github/stars/user6811992/aegisai-harness)](https://github.com/user6811992/aegisai-harness/stargazers)

A **feature-rich, local-only AI agent harness** G�� OpenCode-class runtime, but
offline-first: no cloud dependencies, no telemetry. 85 milestones, ~275 modules,
257 tests, CI green.

> Status: v1.0.9 (see [ROADMAP.md](./ROADMAP.md)).
> **Successor to [aegisai-next](https://github.com/user6811992/aegisai-next)** G�� that project is deprecated; all features have been ported here.
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
- **Multi-agent** (DAG orchestration, swarm, teams, multi-critic, task phases, async/background tools).
- **Quality gates** (skill eval, harness lint, adversarial stress, CI template, conformance testing).
- **Git-aware editing** (status, diff, commit, blame, branch, stash, log, multi-file diff review, auto-commit).
- **Model providers** (18: Ollama, LM Studio, llama.cpp, vLLM, OpenAI, Anthropic, Groq, Mistral, DeepSeek, Together, Fireworks, Cohere, OpenRouter, Gemini, etc.).
- **Plugin marketplace** (search, install, uninstall, enable/disable, categories, ratings).
- **IM channels** (Telegram, Discord, DingTalk, Feishu).
- **LSP integration** (hover, definition, completion, diagnostics).

## Quick start

```bash
git clone https://github.com/user6811992/aegisai-harness.git
cd aegisai-harness
npm install
npm start
```

Requires **Node.js 22.13+** (`node -v` to check) and a local backend (Ollama recommended). The Windows installer does **not** bundle Node.js G�� install the LTS from [nodejs.org](https://nodejs.org) first and reopen your terminal so `node` is on PATH.

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

The harness groups the shards into one entry in **Settings G�� Discover** and marks it `[gguf split 1/2]`. Do not select the `00002` shard directly. If you need a single file for Ollama, merge the shards first with `llama-gguf-split --merge`.

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
```

CI enforces `npm run check:version` so `package.json`, the installer filename, docs, and release tag always agree. Release assets include a `.sha256` checksum file G�� verify it before running an installer:

```bash
# PowerShell (in the download folder)
Get-FileHash .\AegisAi-Harness-0.85.0-Setup.exe -Algorithm SHA256
```

## Environment variables

See [ROADMAP.md](./ROADMAP.md) for the full list. Key ones:

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

- **`.js` files open in Notepad / `node` is not recognized** G�� Node.js isn't installed or isn't on PATH. Install Node 22.13+ LTS from https://nodejs.org, reopen the terminal, verify `node -v`, then reinstall/retry. Double-clicking a `.js` file is not how the harness starts.
- **Stale version after uninstalling** G�� the old runtime `node_modules` survives an Inno uninstall in older builds. Delete `%LOCALAPPDATA%\Programs\AegisAiHarness` (or `%LOCALAPPDATA%\AegisAiHarness`) before reinstalling. For npm: `npm uninstall -g aegisai-harness && npm cache clean --force`.
- **Web UI is blank offline** G�� v0.68.0 vendors Preact/Tailwind locally; clear the browser cache if an older service worker is still serving stale assets.
- **Web chat sends empty prompts** G�� fixed in v0.68.0; the browser now posts `message`, matching the server API.

## Layout

```
src/              150+ modules (agent, tools, backends, storage, integrations, ...)
public/           web UI (Preact + Tailwind vendored locally, no build step)
tests/            257 tests (node:test)
packaging/        Windows/macOS/Linux installers + binary build
docs/             landing page (GitHub Pages)
```

## License

MIT

## Acknowledgments

Built with inspiration from the open-source community. See [ROADMAP.md](./ROADMAP.md) for the full list of explored projects and patterns.

### Prior art & inspiration
- **Agent harnesses** G�� OpenCode, Claude Code, Aider, Cline, OpenHands, Goose, Codex, DeerFlow, Symphony, diggerhq
- **MCP** G�� Model Context Protocol (modelcontextprotocol/servers, registry, extensions)
- **Reverse engineering** G�� REA, Ghidra, Craft Anything, awesome-reverse-engineered, netvein
- **Memory & learning** G�� bytedance/deer-flow, volcengine/OpenViking, rohitg00/agentmemory
- **Security** G�� Microsoft agent-governance-toolkit, spec-kitty
- **Observability** G�� OpenTelemetry, SARIF, LangSmith, Langfuse
```
