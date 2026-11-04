# REA installed in this sandbox

Source: https://github.com/morluto/rea (branch `main`, commit fetched 2026-11-04)

## What is here

| Path | What |
| --- | --- |
| `/home/user/rea` | Full source checkout of `morluto/rea`, dependencies installed and compiled (`dist/`). |
| `/home/user/.tools/rea-env` | Pinned published release `rea-agents@6.8.0` (fallback / reference). |
| `/home/user/.tools/node24` | Node.js **24.22.2**, installed because the system Node (22.22.3) is below REA's floor of `>=22.23.4`. |
| `/home/user/.tools/bin/rea` | Launcher → source build (`/home/user/rea`). On `PATH`. |
| `/home/user/.tools/bin/rea-release` | Launcher → pinned npm release copy. |
| `/home/user/.tools/bootstrap-rea.sh` | Idempotent rebuild script (rerun after a fresh sandbox). |
| `/home/user/.agents/skills/reverse-engineer-anything` | REA workflow skill installed by `rea setup`. |

## Use it

```bash
rea --version           # 6.8.0
rea doctor              # readiness report
rea --help              # 200+ commands
rea mcp doctor          # MCP server: 234 tools, healthy
```

Example static analysis (no extra tooling needed):

```bash
rea analyze-javascript-application /path/to/electron-app --json
```

## Using it from an agent (MCP)

REA ships as an MCP server on stdio. No supported agent CLI is installed here, so
setup registered nothing. Register REA once the agent is installed:

```bash
rea setup                       # detects agents (Claude Code, Codex, Cursor, ...)
# or manually:
rea mcp add --agent claude-code
```

The MCP server command is:

```bash
/home/user/.tools/node24/node_modules/node-linux-x64/bin/node /home/user/rea/scripts/rea.mjs
```

(For a clean end-user install instead of a source build, use
`npx rea-agents setup` or `npm install --global rea-agents` on Node 24.22.1+.)

## What needs extra tools

`rea doctor` shows these as `missing_analysis_engine`. They are optional and
depend on the target you analyze:

| Capability | Needs |
| --- | --- |
| Native binary decompilation / pseudocode | Hopper (macOS), Ghidra 12.1.x (`GHIDRA_INSTALL_DIR`), IDA MCP, or Kuna |
| Android APK / DEX | `REA_JADX_MCP_JAR` (jadx-headless-mcp 0.7.1) |
| Websites / screenshots | A Chrome-family browser |
| Firmware extraction, GDB/Rizin runtime work | caller-supplied binwalk/unblob/pwndbg etc. |

Built in and working today: JavaScript/Electron static analysis, .NET/PE,
ELF/Go/Rust/WASM artifacts, IL2CPP, Godot PCK, model files, HAR/SAZ captures,
SQLite, and more — see `rea capabilities`.
