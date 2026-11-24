# Gantt Swarm Tracker Protocol

`gantt-swarm-tracker` is file-backed under `.tracker/` in the target repository root, with build/media outputs in `out/` and `dist/`.

## Directory Layout

```text
<repo-root>/
├── .tracker/
│   ├── plan.json                  # Project metadata, phases, and planned agents
│   ├── events/<agentId>.jsonl     # Append-only JSONL agent lifecycle events
│   ├── checks/<name>.json         # Latest verification check status per check
│   ├── loc-history.json           # Periodic LOC/file count samples
│   └── recording-snapshots.jsonl  # State snapshots captured on each state hash change
├── out/
│   ├── shots/                     # Screenshots displayed in Visual QA gallery
│   ├── previews/                  # Preview images displayed in Visual QA gallery
│   └── recording/
│       ├── frames/frame_00001.png # Headless Chrome timelapse frames
│       ├── status.json            # Recorder active status & frame count
│       └── progress-replay.mp4    # Encoded H.264 timelapse video
└── dist/                          # Packaged release artifacts exposed in dashboard
```

## `.tracker/plan.json`

```json
{
  "project": "My Project",
  "tagline": "Parallel multi-agent swarm execution tracker",
  "startedAt": "2026-01-01T00:00:00.000Z",
  "appUrl": "http://127.0.0.1:3000",
  "appLabel": "OPEN WEB APP",
  "targets": [["core", "Core"], ["web", "Web"], ["security", "Security"]],
  "phases": [
    { "id": "plan", "name": "Planning", "status": "done", "startedAt": "...", "endedAt": "..." },
    { "id": "build", "name": "Build", "status": "active", "startedAt": "..." }
  ],
  "agents": [
    {
      "id": "architect",
      "name": "System Architect",
      "role": "tooling",
      "model": "opus",
      "phase": "plan",
      "wave": 1,
      "desc": "Define module contracts",
      "owns": ["src"]
    }
  ]
}
```

- `appUrl` / `appLabel` (optional): When `appUrl` is set (`http://`, `https://`, or `/`), the dashboard renders an external launch button in the header.
- `model` (optional): Supports Gemini (`pro`, `flash`, `flash_lite`) and Claude (`opus`, `sonnet`, `haiku`, `fable`) badges, or custom model names.
- `targets` (optional): Columns for the Target Matrix (`build-*`, `test-*`, `smoke-*` checks).

## `.tracker/events/<agentId>.jsonl`

One JSON object per line:

```json
{"t":"2026-01-01T00:00:05.000Z","agent":"architect","state":"start","pct":0,"msg":"Designing schema"}
{"t":"2026-01-01T00:00:15.000Z","agent":"architect","state":"progress","pct":60,"msg":"Drafting API"}
{"t":"2026-01-01T00:00:30.000Z","agent":"architect","state":"done","pct":100,"msg":"Complete"}
```

Valid `state` values: `start`, `progress`, `done`, `blocked`, `failed`, `note`.

## `.tracker/checks/<name>.json`

```json
{"name":"build-core","status":"pass","detail":"0 errors","t":"2026-01-01T00:01:00.000Z"}
```

Valid `status` values: `pass`, `fail`, `running`, `skip`.

## HTTP & SSE API

| Method & Path | Description |
| --- | --- |
| `GET /` | Live HTML dashboard |
| `GET /healthz` | Plaintext `ok` healthcheck |
| `GET /api/state` | Current aggregated JSON state snapshot |
| `GET /api/stream` | Server-Sent Events (`event: state`) live stream |
| `GET /api/agent/:id` | Full event log (up to 2000 events) for an agent |
| `GET /api/recording/status` | Frame count, snapshot count, recording flag, MP4 metadata |
| `POST /api/recording/render` | Renders `out/recording/frames/frame_%05d.png` into `progress-replay.mp4` via `ffmpeg` |
| `GET /api/recording/snapshots` | Historical state snapshots (up to last 400) for time-travel scrubbing |
| `GET /files/<relpath>` | Byte-range (`206 Partial Content`) file server strictly confined to `out/` and `dist/` |
