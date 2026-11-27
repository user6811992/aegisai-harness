# Third-Party Notices

AegisAi Harness vendors and/or bundles the following third-party components.

## Runtime / optional npm dependencies
- **better-sqlite3** (MIT) — https://github.com/WiseLibs/better-sqlite3
- **pdf-parse** (MIT) — https://github.com/pdfguide/pdf-parse

## Vendored browser assets (public/vendor/)
- **Preact** (MIT) — https://github.com/preactjs/preact
- **htm** (MIT) — https://github.com/developit/htm
- **KaTeX** (MIT) — https://github.com/KaTeX/KaTeX
- **Mermaid** (MIT) — https://github.com/mermaid-js/mermaid
- **Tailwind CSS** (MIT) — https://github.com/tailwindlabs/tailwindcss

## Native library (optional submodule)
- **ggml** (MIT) — Copyright (c) 2023-2026 The ggml authors — https://github.com/ggml-org/ggml
  (see `ggml/LICENSE`)

## Bundled method pack (git submodule)
- **Aegis Method Pack** (MIT) — GanyuanRan/Aegis v2.16.0 — https://github.com/GanyuanRan/Aegis
  - 22 skills bundled under `vendor/aegis`, imported via `src/aegis_skills.js`
  - Governance patterns (baseline-first, evidence-verified, drift-checked) adapted in `src/governance.js`
  - Retains its MIT license; see `vendor/aegis/LICENSE`

## Adapted patterns (attribution)
The following open-source projects inspired features adapted into AegisAi Harness:
- **harnessforge** (MIT) — https://github.com/jcaiagent7143-ui/harnessforge
  - Project blueprints (SOUL.md, TOOLS.md, MEMORY.md, forbidden-path rules, MCP recommendations)
    adapted into `src/project_init.js`
- **aegis** by apiad (MIT) — https://github.com/apiad/aegis
  - Group/broadcast coordination concepts adapted into the Tauri IPC commands (`backend_broadcast`,
    `backend_group_spawn`, `backend_group_status`)
- **linkdigest-mcp** (MIT) — https://github.com/jcaiagent7143-ui/linkdigest-mcp
  - MCP preset for social media content extraction registered in `src/mcp_presets.js`
  - Hosted service operated by LinkDigest; the harness preset does not bundle the reading engine

All third-party components retain their respective licenses. See each project for full license text.
