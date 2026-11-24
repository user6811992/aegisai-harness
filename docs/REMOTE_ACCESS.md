# Remote access & desktop launchers

## Remote access

The harness web UI binds to `127.0.0.1` by default. For remote access:

- **Tailscale (recommended)** — install Tailscale on the host and client; access `http://<tailscale-ip>:8080` over the private VPN. No port forwarding needed.
- **Cloudflare Quick Tunnel** — `cloudflared tunnel --url http://localhost:8080` gives a temporary public URL with no domain.
- **LAN** — set `HOST=0.0.0.0` **and** `AEGISAI_TOKEN=...`; without a token the server must not be exposed. The token can also be set from the onboarding wizard or `/api/config` and takes effect immediately. Keep `AEGISAI_WEB_AUTO_APPROVE` unset (default false) on any remotely reachable instance — enabling it lets browser clients run tools without approval.

## Desktop launchers

Packaging scripts live in `packaging/`:
- `build.ps1` / `windows/installer.iss` — Windows Inno Setup installer + desktop shortcut
- `macos/build-dmg.sh` — macOS DMG
- `linux/build-appimage.sh` — Linux AppImage
- `build-binary.sh` — standalone binary via pkg

Optional enhancements (not yet bundled): system-tray icon, auto-start (systemd user/launchd), and an Edge/Chrome app-window launcher. These can be added as post-install steps using the platform's native tooling.
