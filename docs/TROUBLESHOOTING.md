# Troubleshooting installation and stale versions

## Node.js is missing or `.js` files open in Notepad

AegisAi Harness is a Node.js application. **Neither the Windows installer nor the npm package installs Node.js.**

1. Install the current **Node.js 22.13+ LTS** from https://nodejs.org (the "LTS" installer is fine).
2. **Close and reopen** your terminal/Start Menu shortcuts so `PATH` is refreshed.
3. Verify in a new terminal:

   ```bat
   node -v
   npm -v
   ```

If `node -v` fails, reinstall Node and reboot. Double-clicking a `.js` file opening Notepad is only a Windows file-association default — the harness is launched through `aegisai-harness.cmd`, `node src\index.js`, or `npm start`, so the association is irrelevant.

## Stale version after uninstalling (Windows installer)

Older installers left runtime-generated `node_modules/` and `data/` behind, and old shortcuts could launch an earlier copy. v0.68.0 removes `node_modules` on uninstall and uses a stable `AppId`, but if you already have stale state:

```bat
:: 1. Uninstall via Settings > Apps first, then:
rd /s /q "%LOCALAPPDATA%\Programs\AegisAiHarness"
rd /s /q "%LOCALAPPDATA%\AegisAiHarness"
rd /s /q "%LOCALAPPDATA%\AegisAiHarness\node_modules"

:: 2. Delete the old shortcuts (Start Menu > AegisAi Harness > Uninstall, or remove the folder)
:: 3. Install the newest Setup.exe and verify:
"%LOCALAPPDATA%\Programs\AegisAiHarness\aegisai-harness.cmd" --version
```

The expected version for this release is **1.0.30**. `data/` inside the install folder holds your sessions and memories — back it up before deleting if you want to keep it.

## Stale version after `npm i -g`

```bat
npm uninstall -g aegisai-harness
npm cache clean --force
npm i -g aegisai-harness@latest
where aegisai-harness
aegisai-harness --version
```

If `where` lists more than one path, an older copy is shadowing the new one — remove the stale folder shown. On Linux/macOS, the CLI requires a shebang (added in v0.68.0); if an older global install reports "permission denied", reinstall with `npm i -g aegisai-harness@latest`.

## Web UI is blank or stale

- v0.68.0 loads **all** UI dependencies from `public/vendor/` — no CDN is required.
- If you upgraded from an older version, an old service worker can keep serving cached files. In DevTools → Application → Service Workers, choose **Unregister**, then hard-reload (Ctrl+Shift+R).
- The app needs the server running: `npm start -- --web`, then open http://127.0.0.1:8080.

## "No SQLite backend available" / persistence silently lost

`node:sqlite` needs Node 22.13+ unflagged. On 22.5–22.12 the app falls back to the optional native `better-sqlite3`, which may fail to build. Upgrade Node, then reinstall so optional dependencies are rebuilt:

```bat
npm i -g aegisai-harness@latest
```

## Web chat appears to do nothing

Fixed in v0.68.0. Older builds sent `{prompt: ...}` while the server expected `{message: ...}`, so the model received an empty user message. Update to 0.68.0 and hard-reload the browser.

## Tool calls rejected in the web UI

Since v0.68.0 web chat never auto-approves tool calls by default. Set `AEGISAI_WEB_AUTO_APPROVE=true` only if you trust every client that can reach the web server, and never expose `--web` on `HOST=0.0.0.0` without `AEGISAI_TOKEN`.
