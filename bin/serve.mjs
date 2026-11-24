#!/usr/bin/env node
// Gantt Swarm Tracker — zero-dependency live dashboard server.
import http from 'node:http';
import { promises as fsp, createReadStream, realpathSync } from 'node:fs';
import { join, dirname, resolve, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DASHBOARD_DIR = resolve(HERE, '..', 'dashboard');
const DEFAULT_CODE_DIRS = ['src', 'lib', 'app', 'web', 'android', 'ios', 'cmd', 'pkg', 'docs', 'scripts', 'test', 'tests', 'tracker'];
const SKIP_DIRS = new Set(['node_modules', 'build', '.gradle', 'dist', 'out', '.tracker', '.git', '.idea', '.next', 'target', '__pycache__']);
const TEXT_EXT = new Set([
  '.kt', '.kts', '.xml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json',
  '.html', '.css', '.scss', '.md', '.sh', '.py', '.gradle', '.properties', '.pro',
  '.txt', '.yml', '.yaml', '.toml', '.svg', '.rs', '.go', '.java', '.rb', '.php',
  '.c', '.h', '.cpp', '.hpp', '.sql', '.vue', '.svelte',
]);
const MAX_LOC_BYTES = 4 * 1024 * 1024;

const MIME = {
  '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive', '.gz': 'application/gzip',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const log = (...a) => console.log(new Date().toISOString(), ...a);
async function readText(p) { try { return await fsp.readFile(p, 'utf8'); } catch { return null; } }
async function readJSON(p) {
  const s = await readText(p);
  if (!s || !s.trim()) return null;
  try { return JSON.parse(s); } catch { return null; }
}
async function listDir(p) { try { return await fsp.readdir(p, { withFileTypes: true }); } catch { return []; } }
const str = (v, d = '') => (typeof v === 'string' ? v : v == null ? d : String(v));
const isoOk = s => typeof s === 'string' && !Number.isNaN(Date.parse(s));

export function createTrackerServer(options = {}) {
  const ROOT = resolve(options.root || process.env.TRACKER_ROOT || process.cwd());
  const PORT = options.port !== undefined && !Number.isNaN(Number(options.port))
    ? Number(options.port)
    : Number(process.env.TRACKER_PORT ?? 4780);
  const HOST = options.host || process.env.TRACKER_HOST || '127.0.0.1';
  const DASHBOARD_DIR = resolve(options.dashboardDir || DEFAULT_DASHBOARD_DIR);
  const TRK = join(ROOT, '.tracker');
  const rawCodeDirs = options.codeDirs ?? process.env.TRACKER_CODE_DIRS;
  const explicitCodeDirs = Boolean(rawCodeDirs && String(rawCodeDirs).trim());
  const CODE_DIRS = explicitCodeDirs
    ? String(rawCodeDirs).split(',').map(x => x.trim()).filter(Boolean)
    : DEFAULT_CODE_DIRS;

  let lastGoodPlan = null;
  async function loadPlan() {
    const p = await readJSON(join(TRK, 'plan.json'));
    if (p && typeof p === 'object') lastGoodPlan = p;
    return lastGoodPlan || {};
  }

  const eventCache = new Map();
  async function loadEvents() {
    const dir = join(TRK, 'events');
    const out = {};
    const seen = new Set();
    for (const d of await listDir(dir)) {
      if (!d.isFile() || !d.name.endsWith('.jsonl')) continue;
      const f = join(dir, d.name);
      seen.add(f);
      let st; try { st = await fsp.stat(f); } catch { continue; }
      const c = eventCache.get(f);
      let events;
      if (c && c.size === st.size && c.mtimeMs === st.mtimeMs) {
        events = c.events;
      } else {
        const txt = (await readText(f)) || '';
        events = [];
        for (const line of txt.split('\n')) {
          const l = line.trim();
          if (!l) continue;
          try {
            const e = JSON.parse(l);
            if (e && typeof e === 'object') events.push(e);
          } catch { /* truncated line */ }
        }
        eventCache.set(f, { size: st.size, mtimeMs: st.mtimeMs, events });
      }
      const fileId = d.name.replace(/\.jsonl$/, '');
      for (const e of events) {
        const id = str(e.agent || fileId);
        (out[id] ||= []).push({
          t: isoOk(e.t) ? e.t : null,
          agent: id,
          state: ['start', 'progress', 'done', 'blocked', 'failed', 'note'].includes(e.state) ? e.state : 'note',
          pct: typeof e.pct === 'number' && Number.isFinite(e.pct) ? Math.max(0, Math.min(100, e.pct)) : null,
          msg: str(e.msg).slice(0, 2000),
        });
      }
    }
    for (const k of eventCache.keys()) if (!seen.has(k)) eventCache.delete(k);
    for (const k in out) out[k].sort((a, b) => (Date.parse(a.t) || 0) - (Date.parse(b.t) || 0));
    return out;
  }

  async function loadChecks() {
    const dir = join(TRK, 'checks');
    const out = [];
    for (const d of await listDir(dir)) {
      if (!d.isFile() || !d.name.endsWith('.json')) continue;
      const c = await readJSON(join(dir, d.name));
      if (!c || typeof c !== 'object') continue;
      const name = str(c.name || d.name.replace(/\.json$/, ''));
      out.push({
        name,
        status: ['pass', 'fail', 'running', 'skip'].includes(c.status) ? c.status : 'skip',
        detail: str(c.detail).slice(0, 1000),
        t: isoOk(c.t) ? c.t : null,
        group: (name.match(/^([a-z]+)-/) || [, 'other'])[1],
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async function walk(dir, rel, acc) {
    for (const d of await listDir(dir)) {
      if (d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
      const p = join(dir, d.name), r = rel ? rel + '/' + d.name : d.name;
      if (d.isDirectory()) await walk(p, r, acc);
      else if (d.isFile()) acc.push({ p, r });
    }
  }

  const locCache = new Map();
  async function countLines(p, st) {
    const c = locCache.get(p);
    if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return c.lines;
    let lines = 0;
    if (TEXT_EXT.has(extname(p).toLowerCase()) && st.size <= MAX_LOC_BYTES) {
      try {
        const buf = await fsp.readFile(p);
        for (let i = 0; i < buf.length; i++) if (buf[i] === 10) lines++;
        if (buf.length && buf[buf.length - 1] !== 10) lines++;
      } catch { lines = 0; }
    }
    locCache.set(p, { mtimeMs: st.mtimeMs, size: st.size, lines });
    return lines;
  }

  let scanCache = null, scanAt = 0, scanning = null;
  async function scanTree() {
    if (scanCache && Date.now() - scanAt < 4000) return scanCache;
    if (scanning) return scanning;
    scanning = (async () => {
      const acc = [];
      const activeDirs = [];
      for (const d of CODE_DIRS) {
        const dp = join(ROOT, d);
        let st; try { st = await fsp.stat(dp); } catch { st = null; }
        if (st && st.isDirectory()) {
          activeDirs.push(d);
          await walk(dp, d, acc);
        } else if (explicitCodeDirs) {
          activeDirs.push(d);
        }
      }
      const files = [];
      for (const f of acc) {
        let st; try { st = await fsp.stat(f.p); } catch { continue; }
        files.push({ path: f.r, mtime: st.mtimeMs, size: st.size, lines: await countLines(f.p, st) });
      }
      const top = [];
      for (const d of await listDir(ROOT)) {
        if (!d.isFile() || d.name.startsWith('.')) continue;
        const p = join(ROOT, d.name);
        let st; try { st = await fsp.stat(p); } catch { continue; }
        top.push({ path: d.name, mtime: st.mtimeMs, size: st.size, lines: await countLines(p, st) });
      }
      const byDir = {};
      for (const d of activeDirs) byDir[d] = { files: 0, loc: 0 };
      let loc = 0;
      for (const f of files) {
        loc += f.lines;
        const k = f.path.split('/')[0];
        if (byDir[k]) { byDir[k].files++; byDir[k].loc += f.lines; }
      }
      scanCache = { files, top, totals: { files: files.length, loc, byDir } };
      scanAt = Date.now();
      scanning = null;
      return scanCache;
    })().catch(e => {
      scanning = null;
      log('scan', e);
      return scanCache || { files: [], top: [], totals: { files: 0, loc: 0, byDir: {} } };
    });
    return scanning;
  }

  function ownedLoc(owns, scan) {
    if (!Array.isArray(owns)) return { loc: 0, files: 0 };
    let loc = 0, files = 0;
    const all = scan.files.concat(scan.top);
    const seen = new Set();
    for (const o of owns) {
      const own = str(o).replace(/^\.\//, '').replace(/\*\*$/, '').replace(/\*$/, '');
      if (!own) continue;
      for (const f of all) {
        if (seen.has(f.path)) continue;
        if (own.endsWith('/') ? f.path.startsWith(own) : (f.path === own || f.path.startsWith(own + '/'))) {
          seen.add(f.path); loc += f.lines; files++;
        }
      }
    }
    return { loc, files };
  }

  const HIST_FILE = join(TRK, 'loc-history.json');
  let history = [];
  async function loadHistory() {
    const h = await readJSON(HIST_FILE);
    if (Array.isArray(h)) history = h.filter(x => x && typeof x.t === 'number' && typeof x.loc === 'number');
  }
  async function sampleHistory() {
    try {
      const s = await scanTree();
      const last = history[history.length - 1];
      const pt = { t: Date.now(), loc: s.totals.loc, files: s.totals.files };
      if (last && history.length >= 2 && history[history.length - 2].loc === last.loc && last.loc === pt.loc && last.files === pt.files) {
        history[history.length - 1] = pt;
      } else {
        history.push(pt);
      }
      if (history.length > 5000) history = history.filter((_, i) => i % 2 === 0 || i > history.length - 500);
      try {
        await fsp.mkdir(TRK, { recursive: true });
        const tmp = HIST_FILE + '.tmp' + process.pid;
        await fsp.writeFile(tmp, JSON.stringify(history));
        await fsp.rename(tmp, HIST_FILE);
      } catch { /* ignore */ }
    } catch (e) { log('history', e); }
  }

  async function walkImages(base, kind, acc) {
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      for (const d of await listDir(dir)) {
        if (d.name.startsWith('.')) continue;
        const p = join(dir, d.name);
        if (d.isDirectory()) stack.push(p);
        else if (d.isFile() && /\.(png|gif|jpe?g|webp|svg)$/i.test(d.name)) {
          let st; try { st = await fsp.stat(p); } catch { continue; }
          if (!st.size) continue;
          acc.push({ kind, path: relative(ROOT, p).split(sep).join('/'), name: d.name, mtime: st.mtimeMs, size: st.size });
        }
      }
    }
  }
  async function loadGallery() {
    const acc = [];
    await walkImages(join(ROOT, 'out', 'previews'), 'preview', acc);
    await walkImages(join(ROOT, 'out', 'shots'), 'shot', acc);
    acc.sort((a, b) => b.mtime - a.mtime);
    return acc.slice(0, 200);
  }
  async function loadArtifacts() {
    const acc = [];
    const stack = [[join(ROOT, 'dist'), 0]];
    while (stack.length) {
      const [dir, depth] = stack.pop();
      for (const d of await listDir(dir)) {
        if (d.name.startsWith('.')) continue;
        const p = join(dir, d.name);
        let st; try { st = await fsp.stat(p); } catch { continue; }
        if (d.isDirectory()) {
          if (depth < 3) stack.push([p, depth + 1]);
        } else if (d.isFile()) {
          acc.push({ path: relative(ROOT, p).split(sep).join('/'), name: d.name, size: st.size, mtime: st.mtimeMs });
        }
      }
    }
    acc.sort((a, b) => b.mtime - a.mtime);
    return acc.slice(0, 100);
  }

  async function buildState() {
    const [plan, evs, checks, scan, gallery, artifacts] = await Promise.all([
      loadPlan(), loadEvents(), loadChecks(), scanTree(), loadGallery(), loadArtifacts(),
    ]);
    const planAgents = Array.isArray(plan.agents) ? plan.agents.filter(a => a && a.id) : [];
    const ids = new Set(planAgents.map(a => str(a.id)));
    const agentsIn = planAgents.map(a => ({ ...a, id: str(a.id), inPlan: true }));
    for (const id of Object.keys(evs)) if (!ids.has(id)) agentsIn.push({ id, name: id, role: 'unplanned', model: '', owns: [], inPlan: false });

    const feed = [];
    const agents = agentsIn.map((a, idx) => {
      const list = evs[a.id] || [];
      let state = 'queued', pct = null, lastMsg = '', lastT = null, startedAt = null, endedAt = null;
      const segs = [];
      for (const e of list) {
        if (e.t && !startedAt) startedAt = e.t;
        if (e.state !== 'note') {
          const s = e.state === 'start' || e.state === 'progress' ? 'running' : e.state;
          if (s !== state && e.t) {
            if (segs.length) segs[segs.length - 1].to = e.t;
            segs.push({ state: s, from: e.t, to: null });
          }
          state = s;
          endedAt = (s === 'done' || s === 'failed') ? e.t : null;
        }
        if (e.pct != null) pct = e.pct;
        if (e.msg) lastMsg = e.msg;
        if (e.t) lastT = e.t;
      }
      if (list.length && state === 'queued') state = 'running';
      if (segs.length && endedAt) segs[segs.length - 1].to = endedAt;
      for (const e of list.slice(-120)) feed.push(e);
      const own = ownedLoc(a.owns, scan);
      return {
        id: a.id, name: str(a.name, a.id), role: str(a.role, 'misc') || 'misc', model: str(a.model).toLowerCase(),
        phase: str(a.phase), wave: a.wave ?? null, desc: str(a.desc),
        owns: Array.isArray(a.owns) ? a.owns.map(x => str(x)) : [],
        inPlan: a.inPlan, order: idx,
        state, pct: state === 'done' ? 100 : pct, lastMsg, lastT, startedAt, endedAt,
        eventCount: list.length, loc: own.loc, ownedFiles: own.files, segments: segs,
        marks: list.filter(e => e.t && e.state !== 'start').slice(-60).map(e => [e.t, e.state]),
      };
    });

    feed.sort((a, b) => (Date.parse(b.t) || 0) - (Date.parse(a.t) || 0));
    const counts = { queued: 0, running: 0, done: 0, blocked: 0, failed: 0 };
    for (const a of agents) counts[a.state]++;
    const progress = agents.length ? agents.reduce((s, a) => s + (a.state === 'done' ? 100 : a.pct || 0), 0) / agents.length : 0;
    const recent = scan.files.slice().sort((a, b) => b.mtime - a.mtime).slice(0, 30);
    let firstEvent = null;
    for (const a of agents) if (a.startedAt && (!firstEvent || a.startedAt < firstEvent)) firstEvent = a.startedAt;

    const phases = Array.isArray(plan.phases) ? plan.phases.filter(Boolean).map(p => ({
      id: str(p.id),
      name: str(p.name, p.id),
      status: ['pending', 'active', 'done'].includes(p.status) ? p.status : 'pending',
      startedAt: isoOk(p.startedAt) ? p.startedAt : null,
      endedAt: isoOk(p.endedAt) ? p.endedAt : null,
    })) : [];

    return {
      project: str(plan.project, 'Gantt Swarm Tracker'),
      tagline: str(plan.tagline),
      appUrl: str(plan.appUrl).trim() || null,
      appLabel: str(plan.appLabel).trim() || null,
      targets: Array.isArray(plan.targets) ? plan.targets : null,
      startedAt: isoOk(plan.startedAt) ? plan.startedAt : firstEvent,
      firstEvent,
      phases,
      agents, counts, progress,
      feed: feed.slice(0, 120),
      checks, gallery, artifacts,
      totals: scan.totals,
      loc: history.slice(-1500),
      recent,
      hasPlan: !!lastGoodPlan,
    };
  }

  let current = null, currentJSON = 'null', currentHash = '';
  const clients = new Set();
  const SNAPSHOTS_FILE = join(TRK, 'recording-snapshots.jsonl');
  async function recordSnapshot(s) {
    try {
      await fsp.mkdir(TRK, { recursive: true });
      const snap = {
        serverTime: new Date().toISOString(),
        project: s.project, tagline: s.tagline, appUrl: s.appUrl, appLabel: s.appLabel, targets: s.targets,
        startedAt: s.startedAt, firstEvent: s.firstEvent,
        phases: s.phases, agents: s.agents, counts: s.counts, progress: s.progress,
        feed: s.feed.slice(0, 40), checks: s.checks, totals: s.totals,
        loc: s.loc.slice(-120), recent: s.recent.slice(0, 12), gallery: s.gallery.slice(0, 24), artifacts: s.artifacts,
      };
      await fsp.appendFile(SNAPSHOTS_FILE, JSON.stringify(snap) + '\n');
    } catch { /* ignore snapshot write errors */ }
  }
  async function refresh() {
    try {
      const s = await buildState();
      const body = JSON.stringify(s);
      const h = createHash('sha1').update(body).digest('hex');
      current = s;
      if (h !== currentHash) {
        currentHash = h;
        currentJSON = body;
        broadcast();
        await recordSnapshot(s);
      }
    } catch (e) { log('refresh', e?.stack || e); }
  }
  function payload() {
    return currentJSON.replace(/^\{/, '{"serverTime":' + JSON.stringify(new Date().toISOString()) + ',"hash":"' + currentHash + '",');
  }
  function broadcast() {
    const data = 'event: state\ndata: ' + payload() + '\n\n';
    for (const res of clients) { try { res.write(data); } catch { clients.delete(res); } }
  }

  const REC_DIR = join(ROOT, 'out', 'recording');
  const FRAMES_DIR = join(REC_DIR, 'frames');
  const VIDEO_PATH = join(REC_DIR, 'progress-replay.mp4');

  async function getRecordingStatus() {
    const frames = (await listDir(FRAMES_DIR)).filter(d => d.isFile() && /^frame_\d+\.png$/.test(d.name));
    const statusJson = await readJSON(join(REC_DIR, 'status.json'));
    let video = null;
    try {
      const st = await fsp.stat(VIDEO_PATH);
      if (st.isFile() && st.size > 0) video = { url: '/files/out/recording/progress-replay.mp4', size: st.size, mtime: st.mtimeMs };
    } catch { /* no video yet */ }
    const snapTxt = (await readText(SNAPSHOTS_FILE)) || '';
    const snapshotCount = snapTxt ? snapTxt.trim().split('\n').filter(Boolean).length : 0;
    return {
      recording: !!statusJson?.active,
      frameCount: frames.length,
      snapshotCount,
      lastCapturedAt: statusJson?.lastCapturedAt || null,
      video,
    };
  }

  let renderingVideo = null;
  async function renderProgressVideo() {
    if (renderingVideo) return renderingVideo;
    renderingVideo = (async () => {
      const frames = (await listDir(FRAMES_DIR)).filter(d => d.isFile() && /^frame_\d+\.png$/.test(d.name));
      if (!frames.length) return { ok: false, error: 'No frames captured yet', frameCount: 0 };
      await fsp.mkdir(REC_DIR, { recursive: true });
      const tmpOut = VIDEO_PATH + '.tmp.mp4';
      await execFileAsync('ffmpeg', [
        '-y', '-framerate', '4',
        '-i', join(FRAMES_DIR, 'frame_%05d.png'),
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        tmpOut,
      ], { timeout: 60000 });
      await fsp.rename(tmpOut, VIDEO_PATH);
      const st = await fsp.stat(VIDEO_PATH);
      return { ok: true, frameCount: frames.length, size: st.size, videoUrl: '/files/out/recording/progress-replay.mp4?v=' + Math.round(st.mtimeMs) };
    })().finally(() => { renderingVideo = null; });
    return renderingVideo;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const rawReq = req.url || '/';
      const rawPath = rawReq.split('?')[0];
      const url = new URL(rawReq, 'http://x');
      const path = url.pathname;

      if (rawPath.startsWith('/files/')) {
        let rel = '';
        try { rel = decodeURIComponent(rawPath.slice(7)); } catch { rel = ''; }
        if (!rel || rel.includes('\0')) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('forbidden'); }
        const abs = resolve(ROOT, rel);
        const okBase = ['out', 'dist'].some(b => abs.startsWith(join(ROOT, b) + sep));
        if (!okBase) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('forbidden'); }
        let st; try { st = await fsp.stat(abs); } catch { st = null; }
        if (!st || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
        const real = await fsp.realpath(abs).catch(() => abs);
        const rr = await fsp.realpath(ROOT).catch(() => ROOT);
        if (!['out', 'dist'].some(b => real.startsWith(join(rr, b) + sep))) {
          res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('forbidden');
        }
        const mime = MIME[extname(abs).toLowerCase()] || 'application/octet-stream';
        const range = req.headers.range;
        if (range) {
          const m = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (m) {
            const start = m[1] ? Number(m[1]) : 0;
            const end = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
            if (start >= st.size || start > end) {
              res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
              return res.end();
            }
            res.writeHead(206, {
              'Content-Type': mime,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${end}/${st.size}`,
              'Content-Length': end - start + 1,
              'Cache-Control': 'no-cache',
            });
            const s = createReadStream(abs, { start, end });
            s.on('error', () => res.destroy());
            return s.pipe(res);
          }
        }
        res.writeHead(200, {
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Length': st.size,
          'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        const s = createReadStream(abs);
        s.on('error', () => res.destroy());
        return s.pipe(res);
      }

      if (path === '/' || path === '/index.html') {
        const html = await readText(join(DASHBOARD_DIR, 'index.html'));
        res.writeHead(html ? 200 : 503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html || '<h1>index.html missing</h1>');
      }
      if (path === '/api/state') {
        await refresh();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(payload());
      }
      if (path === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 2000\n\n');
        if (!current) await refresh();
        res.write('event: state\ndata: ' + payload() + '\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (path === '/api/recording/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(await getRecordingStatus()));
      }
      if (path === '/api/recording/render' && req.method === 'POST') {
        const result = await renderProgressVideo();
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(result));
      }
      if (path === '/api/recording/snapshots') {
        const txt = (await readText(SNAPSHOTS_FILE)) || '';
        const lines = txt.split('\n').filter(Boolean).slice(-400);
        const snapshots = [];
        for (const l of lines) { try { snapshots.push(JSON.parse(l)); } catch { /* */ } }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ snapshots }));
      }
      if (path.startsWith('/api/agent/')) {
        let id = ''; try { id = decodeURIComponent(path.slice(11)); } catch { /* */ }
        const evs = await loadEvents();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ id, events: (evs[id] || []).slice(-2000) }));
      }
      if (path === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found');
    } catch (e) {
      log('req', e?.stack || e);
      try { res.writeHead(500); res.end('error'); } catch { /* */ }
    }
  });

  const timers = [];
  let busy = false;

  async function start() {
    await loadHistory();
    await refresh();
    await sampleHistory();
    timers.push(setInterval(async () => {
      if (busy) return;
      busy = true;
      try { await refresh(); } finally { busy = false; }
    }, 1000));
    timers.push(setInterval(sampleHistory, 10000));
    timers.push(setInterval(() => {
      for (const res of clients) { try { res.write(': ping\n\n'); } catch { clients.delete(res); } }
    }, 15000));
    return new Promise((resolveStart, rejectStart) => {
      server.once('error', rejectStart);
      server.listen(PORT, HOST, () => {
        server.removeListener('error', rejectStart);
        const addr = server.address();
        const boundPort = typeof addr === 'object' && addr ? addr.port : PORT;
        resolveStart({ port: boundPort, host: HOST, root: ROOT });
      });
    });
  }

  async function stop() {
    for (const t of timers) clearInterval(t);
    timers.length = 0;
    for (const res of clients) { try { res.end(); } catch { /* ignore */ } }
    clients.clear();
    return new Promise(res => server.close(() => res()));
  }

  return { server, start, stop, refresh, buildState, root: ROOT };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' && i + 1 < argv.length) out.root = argv[++i];
    else if (a.startsWith('--root=')) out.root = a.slice(7);
    else if (a === '--port' && i + 1 < argv.length) out.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) out.port = Number(a.slice(7));
    else if (a === '--host' && i + 1 < argv.length) out.host = argv[++i];
    else if (a.startsWith('--host=')) out.host = a.slice(7);
    else if (a === '--code-dirs' && i + 1 < argv.length) out.codeDirs = argv[++i];
    else if (a.startsWith('--code-dirs=')) out.codeDirs = a.slice(12);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`gantt-tracker - Live parallel Gantt & swarm dashboard server

Usage:
  gantt-tracker [--root <dir>] [--port <n>] [--host <ip>] [--code-dirs <d1,d2>]

Options:
  --root <dir>       Repository root containing .tracker/ (env: TRACKER_ROOT, default: cwd)
  --port <n>         HTTP port (env: TRACKER_PORT, default: 4780; 0 for ephemeral)
  --host <ip>        Bind address (env: TRACKER_HOST, default: 127.0.0.1)
  --code-dirs <list> Comma-separated dirs for LOC scan (env: TRACKER_CODE_DIRS)
  -h, --help         Show this help`);
}

let isMain = false;
try {
  if (process.argv[1]) {
    isMain = realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  }
} catch { isMain = false; }

if (isMain) {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    process.exit(0);
  }
  process.on('uncaughtException', e => log('uncaught', e?.stack || e));
  process.on('unhandledRejection', e => log('unhandled', e?.stack || e));
  const instance = createTrackerServer(cli);
  instance.server.on('error', e => { log('server error', e.message); process.exit(1); });
  const bound = await instance.start();
  log(`gantt-swarm-tracker listening on http://${bound.host}:${bound.port}/ root=${bound.root}`);
}
