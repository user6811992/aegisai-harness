# AegisAi Harness — Tauri Windows shell

A native Windows desktop shell for the harness. It wraps the existing web UI
(`public/`) in a WebView2 window and manages the Node backend process for you.

## Features

- **Backend lifecycle** — spawns `node src/index.js --web` on port 8080, waits until
  it is listening, then points the window at `http://127.0.0.1:8080`. Restart and
  stop are available from the tray menu and IPC commands.
- **System tray** — left-click shows/focuses the window. Menu: **Show Window**,
  **Restart Backend**, **Quit**. Closing the window hides to tray; use Quit to exit
  (which also terminates the backend).
- **IPC commands** (localhost origin only): `backend_status`, `backend_start`,
  `backend_stop`, `backend_restart`. Exposed with `withGlobalTauri` so the web UI
  can call `window.__TAURI__.invoke(...)` if desired.
- **Bundled resources** — `src/`, `public/`, `scripts/`, `package.json`, LICENSE and
  THIRD_PARTY_NOTICES are embedded in the installer so the app runs without a
  separate repo checkout. Node.js 22.13+ must be on `PATH`.

## Development

Prerequisites: Rust (stable), Node.js 22.13+, WebView2 runtime, and the MSVC C++
build tools (Visual Studio 2022 Build Tools with "Desktop development with C++").

```powershell
cd packaging/tauri
cargo install tauri-cli --version "^2" --locked
cargo tauri dev
```

`cargo tauri dev` runs `beforeDevCommand` (`node ../../src/index.js --web`) and
opens the window at `http://127.0.0.1:8080`.

## Building installers

```powershell
cd packaging/tauri
cargo tauri build
```

Outputs:
- `target/release/bundle/msi/*.msi`
- `target/release/bundle/nsis/AegisAi-Harness-<version>-Setup.exe`

The release workflow (`.github/workflows/release.yml`) builds these on
`windows-latest` and attaches them to the GitHub release alongside the Inno
Setup installer.

## Security notes

- The window loads only the local backend origin (`127.0.0.1:8080`); no remote
  content is bundled.
- The capability file (`capabilities/default.json`) grants IPC only to that
  origin. The harness backend's own same-origin CORS check remains intact.
- The backend is spawned with `CREATE_NO_WINDOW` on Windows so no console pops up.
