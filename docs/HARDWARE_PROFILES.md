# Hardware Profiles

A hardware profile is a small, local JSON file that records the backend and
launch settings that work well on a particular machine. Profiles are opt-in,
stored under `data/profiles/`, and the one marked active is applied at startup —
before backend detection. No hardware-specific defaults are bundled with the
harness, so it stays universal.

## Format

Only whitelisted fields are accepted. Unknown fields and unsafe values are
dropped with a warning — a shared profile can never carry a command, script, or
arbitrary URL.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required, 1–64 safe characters |
| `backendType` | string | A supported backend (`ollama`, `llamacpp`, `lmstudio`, …) |
| `engine` | string | e.g. `llama.cpp (Vulkan)` |
| `quant` | string | e.g. `Q4_K_M` |
| `context` | integer | 512–262144 |
| `threads` | integer | 1–128 |
| `gpuLayers` | integer | 0–999 |
| `host`, `port` | string/int | Backend server address, e.g. `127.0.0.1:8081` |
| `model` | string | Optional GGUF path (max 260 chars) |
| `flags` | string[] | Max 16 safe CLI flags; no spaces, shell metacharacters or `;` |
| `notes` | string | Up to 500 characters |

`id` and `saved` are added by the harness when you save a profile.

## Example (AMD RX 5700 XT, Vulkan)

```json
{
  "name": "amd-rx5700xt-vulkan",
  "backendType": "llamacpp",
  "engine": "llama.cpp (Vulkan)",
  "quant": "Q6_K",
  "context": 16384,
  "threads": 12,
  "gpuLayers": 40,
  "host": "127.0.0.1",
  "port": 8081,
  "model": "D:\\AiModels\\Uncensored\\LFM3-1.7B-Uncensored-AD-Q6_K.gguf",
  "flags": ["--n-gpu-to-vulkan"],
  "notes": "8 GB VRAM; verify fit with model_fit before larger models"
}
```

## Using profiles

- Web UI: **Settings → Hardware** → *Suggest from hardware* to create one from
  detected capabilities, then **Apply** to make it active.
- API: `GET /api/hardware-profile` lists profiles; `POST /api/hardware-profile`
  accepts `{ "action": "save" | "apply" | "active" | "remove" | "import" |
  "export" | "suggest", "name": "...", "profile": {...} }`.
- MCP: `hardware_profile_list`, `_save`, `_apply`, `_suggest`.
- Sharing: use **Export** to get the JSON, send it to someone, and **Import** it
  on the other machine. They should review the values before applying — the
  harness validates structure, not whether the settings suit their hardware.
