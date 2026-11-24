# gantt-swarm-tracker

Zero-dependency local web host tracker with a collapsible parallel Gantt chart, multi-model agent swarm cards, Tron 1977 themes, and live MP4 progress video replay.

## Features

- **Zero runtime npm dependencies** — Pure Node.js ESM (`node:http`, `node:fs`, `node:crypto`, `node:child_process`) + single-file HTML/SVG/CSS dashboard.
- **Collapsible Parallel Gantt Timeline** — Phase & agent swimlanes, animated active stripes, `NOW` cursor, `ALL` / `1H` / `15M` zoom, hover tooltips, and `localStorage` collapse persistence.
- **Agent Swarm & Model Routing** — Role or state grouping, per-agent LOC ownership & event drawer, and badge/bar support for both **Claude** (`opus`, `sonnet`, `haiku`, `fable`) and **Gemini** (`pro`, `flash`, `flash_lite`) models.
- **Tron 1977 Themes & Palettes** — `GRID` (animated perspective floor), `DARK`, and `LIGHT` modes with 5 neon palettes (`tron-blue`, `mcp-crimson`, `matrix-emerald`, `solar-amber`, `synth-violet`).
- **Progress Video Replay & Time-Travel Scrubber** — Optional headless Chrome frame recorder (`gantt-record`) + server-side `ffmpeg` H.264 MP4 rendering (`POST /api/recording/render`) with `206 Partial Content` streaming and an interactive state-snapshot timelapse slider.
- **Strict File Confinement** — `/files/*` serves only files inside `out/` and `dist/` with canonical `realpath` path-traversal protection.

## Quick Start

```bash
# 1. Scaffold .tracker/plan.json in your project
node /path/to/gantt-swarm-tracker/bin/track.mjs --init "My Project"

# 2. Start the live dashboard server (default: http://127.0.0.1:4780/)
node /path/to/gantt-swarm-tracker/bin/serve.mjs --root . --port 4780
```

Or install globally / link locally:

```bash
npm install -g .
gantt-track --init "My Project"
gantt-tracker --port 4780
```

## CLI Reference

### `gantt-tracker` (`bin/serve.mjs`)

```bash
gantt-tracker [--root <dir>] [--port <n>] [--host <ip>] [--code-dirs <d1,d2>]
```

- `--root <dir>` (env `TRACKER_ROOT`, default `process.cwd()`)
- `--port <n>` (env `TRACKER_PORT`, default `4780`, `0` for ephemeral port)
- `--host <ip>` (env `TRACKER_HOST`, default `127.0.0.1`)
- `--code-dirs <list>` (env `TRACKER_CODE_DIRS`)

### `gantt-track` (`bin/track.mjs`)

```bash
# Initialize .tracker/plan.json
gantt-track [--root <dir>] --init [projectName] [--force]

# Report agent progress
gantt-track [--root <dir>] <agentId> <start|progress|done|blocked|failed|note> [pct] "<message>"

# Report verification check
gantt-track [--root <dir>] --check <name> <pass|fail|running|skip> "<detail>"

# Update phase status
gantt-track [--root <dir>] --phase <phaseId> <pending|active|done>
```

### `gantt-record` (`bin/recorder.mjs`)

Requires `google-chrome` and `ffmpeg` on `PATH`:

```bash
gantt-record [--url <url>] [--root <dir>] [--interval <ms>] [--once]
```

- `--url <url>` (env `TRACKER_URL`, default `http://127.0.0.1:4780/?poll&rec=1`)
- `--root <dir>` (env `TRACKER_ROOT`, default `process.cwd()`)
- `--interval <ms>` (env `REC_INTERVAL_MS`, default `4500`)
- `--once` — Capture a single frame, encode `out/recording/progress-replay.mp4`, and exit.

## Configuration (`plan.json`)

See [PROTOCOL.md](./PROTOCOL.md) for the full schema. Optional header button passthrough:

```json
{
  "project": "My App",
  "appUrl": "http://127.0.0.1:3000",
  "appLabel": "OPEN WEB APP"
}
```

When `appUrl` is omitted or empty, no external app button is rendered.

## Testing

```bash
npm test
```

## License

[MIT](./LICENSE)
