#!/usr/bin/env node
// Continuous headless-Chrome frame recorder for Gantt Swarm Tracker.
// Captures frames to out/recording/frames/frame_00001.png and encodes progress-replay.mp4 via ffmpeg.
import { mkdirSync, readdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = { once: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && i + 1 < argv.length) out.url = argv[++i];
    else if (a.startsWith('--url=')) out.url = a.slice(6);
    else if (a === '--root' && i + 1 < argv.length) out.root = argv[++i];
    else if (a.startsWith('--root=')) out.root = a.slice(7);
    else if (a === '--interval' && i + 1 < argv.length) out.interval = Number(argv[++i]);
    else if (a.startsWith('--interval=')) out.interval = Number(a.slice(11));
    else if (a === '--once') out.once = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

const cli = parseArgs(process.argv.slice(2));
if (cli.help) {
  console.log(`gantt-record - Headless Chrome timelapse recorder for Gantt Swarm Tracker

Usage:
  gantt-record [--url <url>] [--root <dir>] [--interval <ms>] [--once]

Options:
  --url <url>       Dashboard URL to capture (env: TRACKER_URL, default: http://127.0.0.1:4780/?poll&rec=1)
  --root <dir>      Repository root for out/recording (env: TRACKER_ROOT, default: cwd)
  --interval <ms>   Capture interval in milliseconds (env: REC_INTERVAL_MS, default: 4500)
  --once            Capture a single frame, encode MP4, and exit
  -h, --help        Show this help`);
  process.exit(0);
}

const ROOT = resolve(cli.root || process.env.TRACKER_ROOT || process.cwd());
const TRACKER_URL = cli.url || process.env.TRACKER_URL || 'http://127.0.0.1:4780/?poll&rec=1';
const INTERVAL_MS = Number.isFinite(cli.interval) ? cli.interval : Number(process.env.REC_INTERVAL_MS || 4500);
const CHROME_BIN = process.env.CHROME_BIN || 'google-chrome';
const REC_DIR = join(ROOT, 'out', 'recording');
const FRAMES_DIR = join(REC_DIR, 'frames');
const STATUS_FILE = join(REC_DIR, 'status.json');
const VIDEO_PATH = join(REC_DIR, 'progress-replay.mp4');
const CHROME_USER_DATA = join(tmpdir(), `gantt-swarm-tracker-recorder-${process.pid}`);

mkdirSync(FRAMES_DIR, { recursive: true });

function nextFrameIndex() {
  let max = 0;
  for (const name of readdirSync(FRAMES_DIR)) {
    const m = /^frame_(\d+)\.png$/.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

let frameIdx = nextFrameIndex();
let stopping = false;

function writeStatus(active, extra = {}) {
  const tmp = STATUS_FILE + '.tmp.' + process.pid;
  writeFileSync(tmp, JSON.stringify({
    active,
    frameCount: frameIdx - 1,
    lastCapturedAt: new Date().toISOString(),
    ...extra,
  }, null, 2));
  renameSync(tmp, STATUS_FILE);
}

async function encodeVideo() {
  const frames = readdirSync(FRAMES_DIR).filter(n => /^frame_\d+\.png$/.test(n));
  if (!frames.length) return;
  const tmpOut = VIDEO_PATH + '.tmp.mp4';
  await execFileAsync('ffmpeg', [
    '-y', '-framerate', '4',
    '-i', join(FRAMES_DIR, 'frame_%05d.png'),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    tmpOut,
  ], { timeout: 60000 });
  renameSync(tmpOut, VIDEO_PATH);
}

async function captureFrame() {
  const padded = String(frameIdx).padStart(5, '0');
  const tmpPng = join(FRAMES_DIR, `.tmp_frame_${padded}.png`);
  const outPng = join(FRAMES_DIR, `frame_${padded}.png`);
  await execFileAsync(CHROME_BIN, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--user-data-dir=${CHROME_USER_DATA}`,
    '--window-size=1440,900',
    '--virtual-time-budget=2200',
    `--screenshot=${tmpPng}`,
    TRACKER_URL,
  ], { timeout: 15000 });
  renameSync(tmpPng, outPng);
  frameIdx++;
  writeStatus(true);
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  try { await encodeVideo(); } catch (e) { console.error('final encode error:', e.message); }
  writeStatus(false);
  try { rmSync(CHROME_USER_DATA, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (cli.once) {
  try {
    await captureFrame();
    await encodeVideo();
    writeStatus(false);
  } finally {
    try { rmSync(CHROME_USER_DATA, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  process.exit(0);
}

writeStatus(true);
console.log(new Date().toISOString(), 'tracker recorder started ->', FRAMES_DIR);

while (!stopping) {
  const t0 = Date.now();
  try {
    await captureFrame();
    if ((frameIdx - 1) % 6 === 0 || frameIdx === 2) {
      await encodeVideo().catch(e => console.error('encode error:', e.message));
    }
  } catch (e) {
    console.error('capture error:', e.message);
  }
  const wait = Math.max(500, INTERVAL_MS - (Date.now() - t0));
  await new Promise(r => setTimeout(r, wait));
}
