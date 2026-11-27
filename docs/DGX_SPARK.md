# DGX Spark / Blackwell Setup

AegisAi Harness supports local inference on NVIDIA DGX Spark (GB10 Blackwell,
`sm_121`) systems. This guide covers the hardware profile and the one-command
vLLM setup from [@eelbaz](https://github.com/eelbaz/dgx-spark-vllm-setup).

## Automatic detection

`src/hardware.js` detects the `dgx-spark-gb10` profile from GPU/CPU strings
(`DGX Spark`, `GB10`, `sm_121`, `Blackwell`) and recommends:

| Setting | Recommended value |
|---|---|
| Engine | `vllm` |
| Quantization | `NVFP4 / BF16` |
| Context | 131,072 tokens |

Check what your machine detects with:

```bash
node src/index.js --json "what hardware profile am I on?"
# or via the MCP tool `hardware_detect`
```

## One-command vLLM installation

The upstream setup script handles CUDA 13.0, Blackwell-specific MoE kernel
fixes, Triton 3.5.0 from main (required for `sm_121a`), and PyTorch 2.9.0 with
CUDA 13 bindings:

```bash
curl -fsSL https://raw.githubusercontent.com/eelbaz/dgx-spark-vllm-setup/main/install.sh | bash
```

Installation takes ~20–30 minutes (mostly compilation) and needs ~50 GB disk.

Options:

```bash
./install.sh --install-dir ~/my/vllm --vllm-version v0.11.1rc3 --python-version 3.12
```

After installation, point the harness at vLLM:

```bash
export BACKEND_TYPE=vllm
export BACKEND_URL=http://127.0.0.1:8000
npm start
```

## Headless remote desktop

For DGX Spark systems without a physical display,
[`dgx-spark-headless-sunshine`](https://github.com/eelbaz/dgx-spark-headless-sunshine)
provides an automated Sunshine/Moonlight setup with NVENC hardware encoding.
See `docs/REMOTE_ACCESS.md` for general remote-access guidance.

## NVFP4 quantization

For Qwen3-VL-32B on DGX Spark,
[`nvfp4-quantization`](https://github.com/eelbaz/nvfp4-quantization) provides a
Docker-based NVFP4 workflow with vLLM and Open WebUI integration.

---

All third-party setup scripts retain their own licenses; see
`THIRD_PARTY_NOTICES.md`.
