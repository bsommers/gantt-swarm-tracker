#!/usr/bin/env node
// Gantt Swarm Tracker — zero-dependency live dashboard server.
import http from 'node:http';
import { promises as fsp, createReadStream, realpathSync } from 'node:fs';
import { join, dirname, resolve, relative, sep, extname } from 'node:path';
import { homedir } from 'node:os';
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
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.zip': 'application/zip', '.apk': 'application/vnd.android.package-archive',
  '.gz': 'application/gzip', '.mp4': 'video/mp4', '.webm': 'video/webm',
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

  const BRAIN_DIR = resolve(options.brainDir || process.env.TRACKER_BRAIN_DIR || join(homedir(), '.gemini', 'antigravity-cli', 'brain'));
  const MODEL_PRICING = {
    pro: { in: 1.25, cache: 0.3125, out: 10.00 },
    flash_lite: { in: 0.10, cache: 0.025, out: 0.40 },
    flash: { in: 0.30, cache: 0.075, out: 2.50 },
    opus: { in: 15.00, cache: 1.50, out: 75.00 },
    sonnet: { in: 3.00, cache: 0.30, out: 15.00 },
    haiku: { in: 0.80, cache: 0.08, out: 4.00 },
    fable: { in: 3.00, cache: 0.30, out: 15.00 },
    gpt_oss: { in: 0.15, cache: 0.0375, out: 0.60 },
  };

  function resolveTier(actualModel, fallbackModel) {
    for (const raw of [actualModel, fallbackModel]) {
      const m = str(raw).toLowerCase();
      if (!m) continue;
      if (/gpt[-_]?oss/i.test(m)) return 'gpt_oss';
      if (/opus/i.test(m)) return 'opus';
      if (/sonnet/i.test(m)) return 'sonnet';
      if (/haiku/i.test(m)) return 'haiku';
      if (/fable/i.test(m)) return 'fable';
      if (/pro|neon/i.test(m)) return 'pro';
      if (/flash[_-]?lite|lite/i.test(m)) return 'flash_lite';
      if (/flash/i.test(m)) return 'flash';
    }
    return 'flash';
  }

  const transcriptCache = new Map();
  function resolveTranscriptPath(item) {
    if (item?.transcript && typeof item.transcript === 'string') {
      return resolve(ROOT, item.transcript);
    }
    const cid = str(item?.conversationId).trim();
    if (!cid || !/^[a-zA-Z0-9._-]+$/.test(cid)) return null;
    return join(BRAIN_DIR, cid, '.system_generated', 'logs', 'transcript.jsonl');
  }

  async function parseTranscript(filePath) {
    if (!filePath) return null;
    let st;
    try { st = await fsp.stat(filePath); } catch { return null; }
    if (!st.isFile()) return null;
    const cached = transcriptCache.get(filePath);
    if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached.data;

    const txt = await readText(filePath);
    if (txt == null) return null;
    let input = 0, cacheRead = 0, output = 0, turns = 0, contextCurrent = 0, contextPeak = 0, actualModel = '';
    for (const line of txt.split('\n')) {
      const l = line.trim();
      if (!l) continue;
      let e;
      try { e = JSON.parse(l); } catch { continue; }
      if (!e || typeof e !== 'object') continue;
      if (typeof e.model === 'string' && e.model.trim()) actualModel = e.model.trim();
      const hasTok = typeof e.input_tokens === 'number' || typeof e.cache_read_tokens === 'number' || typeof e.output_tokens === 'number';
      if (!hasTok) continue;
      const inTok = typeof e.input_tokens === 'number' && Number.isFinite(e.input_tokens) ? e.input_tokens : 0;
      const cacheTok = typeof e.cache_read_tokens === 'number' && Number.isFinite(e.cache_read_tokens) ? e.cache_read_tokens : 0;
      const outTok = typeof e.output_tokens === 'number' && Number.isFinite(e.output_tokens) ? e.output_tokens : 0;
      input += inTok;
      cacheRead += cacheTok;
      output += outTok;
      turns++;
      const turnCtx = inTok + cacheTok;
      contextCurrent = turnCtx;
      if (turnCtx > contextPeak) contextPeak = turnCtx;
    }
    const data = { input, cacheRead, output, turns, contextCurrent, contextPeak, actualModel };
    transcriptCache.set(filePath, { mtimeMs: st.mtimeMs, size: st.size, data });
    return data;
  }

  async function loadManualTokens() {
    const dir = join(TRK, 'tokens');
    const out = new Map();
    for (const d of await listDir(dir)) {
      if (!d.isFile() || !d.name.endsWith('.json')) continue;
      const c = await readJSON(join(dir, d.name));
      if (!c || typeof c !== 'object') continue;
      const id = str(c.agent || d.name.replace(/\.json$/, ''));
      if (!id) continue;
      const input = Number(c.input) || 0;
      const cacheRead = Number(c.cacheRead) || 0;
      const output = Number(c.output) || 0;
      const contextUsed = Number.isFinite(Number(c.contextUsed)) ? Number(c.contextUsed) : (input + cacheRead);
      out.set(id, {
        input,
        cacheRead,
        output,
        turns: Number(c.turns) > 0 ? Number(c.turns) : 1,
        contextCurrent: contextUsed,
        contextPeak: Number.isFinite(Number(c.contextPeak)) ? Math.max(contextUsed, Number(c.contextPeak)) : contextUsed,
        actualModel: str(c.model).trim(),
      });
    }
    return out;
  }

  function computeTokenStats(raw, planModel) {
    const input = raw?.input || 0;
    const cacheRead = raw?.cacheRead || 0;
    const output = raw?.output || 0;
    const turns = raw?.turns || 0;
    const contextCurrent = raw?.contextCurrent || 0;
    const contextPeak = raw?.contextPeak || 0;
    const actualModel = str(raw?.actualModel).trim();
    const total = input + cacheRead + output;
    const modelKey = actualModel || planModel;
    const contextWindow = /claude|opus|sonnet|haiku|fable/i.test(modelKey) ? 200000 : /gpt[-_]?oss/i.test(modelKey) ? 128000 : 1000000;
    const contextPct = Math.min(100, +(contextPeak / contextWindow * 100).toFixed(1));
    const currentContextPct = Math.min(100, +(contextCurrent / contextWindow * 100).toFixed(1));
    const cacheHitPct = (input + cacheRead) > 0 ? +(cacheRead / (input + cacheRead) * 100).toFixed(1) : 0;
    const tier = resolveTier(actualModel, planModel);
    const rate = MODEL_PRICING[tier] || MODEL_PRICING.flash;
    const estCostUsd = +((input * rate.in + cacheRead * rate.cache + output * rate.out) / 1e6).toFixed(4);
    return {
      input, cacheRead, output, total, turns,
      contextCurrent, contextPeak, contextWindow, contextPct, currentContextPct,
      cacheHitPct, actualModel, tier, estCostUsd,
    };
  }

  function aggregateTokenGroups(rows, keyFn) {
    const map = new Map();
    for (const r of rows) {
      const key = keyFn(r) || 'unknown';
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          tier: r.tier,
          tasks: 0,
          turns: 0,
          input: 0,
          cacheRead: 0,
          output: 0,
          total: 0,
          contextPeak: 0,
          contextWindow: r.contextWindow || 1000000,
          estCostUsd: 0,
        };
        map.set(key, g);
      }
      g.tasks++;
      g.turns += r.turns;
      g.input += r.input;
      g.cacheRead += r.cacheRead;
      g.output += r.output;
      g.total += r.total;
      if (r.contextPeak > g.contextPeak) {
        g.contextPeak = r.contextPeak;
        g.contextWindow = r.contextWindow || g.contextWindow;
      }
      g.estCostUsd = +(g.estCostUsd + r.estCostUsd).toFixed(4);
    }
    const arr = [];
    for (const g of map.values()) {
      g.contextPct = Math.min(100, +(g.contextPeak / g.contextWindow * 100).toFixed(1));
      g.cacheHitPct = (g.input + g.cacheRead) > 0 ? +(g.cacheRead / (g.input + g.cacheRead) * 100).toFixed(1) : 0;
      arr.push(g);
    }
    arr.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
    return arr;
  }

  async function buildState() {
    const [plan, evs, checks, scan, gallery, artifacts, manualTokens] = await Promise.all([
      loadPlan(), loadEvents(), loadChecks(), scanTree(), loadGallery(), loadArtifacts(), loadManualTokens(),
    ]);
    const planAgents = Array.isArray(plan.agents) ? plan.agents.filter(a => a && a.id) : [];
    const ids = new Set(planAgents.map(a => str(a.id)));
    const agentsIn = planAgents.map(a => ({ ...a, id: str(a.id), inPlan: true }));
    for (const id of Object.keys(evs)) if (!ids.has(id)) agentsIn.push({ id, name: id, role: 'unplanned', model: '', owns: [], inPlan: false });

    const agentParsed = await Promise.all(agentsIn.map(async a => {
      const manual = manualTokens.get(a.id);
      if (manual) return manual;
      return parseTranscript(resolveTranscriptPath(a));
    }));

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
      const tokens = computeTokenStats(agentParsed[idx], a.model);
      return {
        id: a.id, name: str(a.name, a.id), role: str(a.role, 'misc') || 'misc', model: str(a.model).toLowerCase(),
        phase: str(a.phase), wave: a.wave ?? null, desc: str(a.desc),
        owns: Array.isArray(a.owns) ? a.owns.map(x => str(x)) : [],
        inPlan: a.inPlan, order: idx,
        state, pct: state === 'done' ? 100 : pct, lastMsg, lastT, startedAt, endedAt,
        eventCount: list.length, loc: own.loc, ownedFiles: own.files, segments: segs,
        marks: list.filter(e => e.t && e.state !== 'start').slice(-60).map(e => [e.t, e.state]),
        tokens,
      };
    });

    let coordinator = null;
    if (plan.coordinator && typeof plan.coordinator === 'object') {
      const c = plan.coordinator;
      const cid = str(c.id, 'coordinator') || 'coordinator';
      const manual = manualTokens.get(cid);
      const parsed = manual || await parseTranscript(resolveTranscriptPath(c));
      const tokens = computeTokenStats(parsed, c.model);
      coordinator = {
        id: cid,
        name: str(c.name, 'Main Coordinator'),
        role: str(c.role, 'coordinator') || 'coordinator',
        model: str(c.model).toLowerCase(),
        phase: str(c.phase, 'coordinator') || 'coordinator',
        state: 'running',
        tokens,
      };
    }

    const allTasks = [];
    if (coordinator) {
      allTasks.push({
        id: coordinator.id,
        name: coordinator.name,
        role: coordinator.role,
        phase: coordinator.phase === 'all' ? 'coordinator' : coordinator.phase,
        model: coordinator.model,
        state: coordinator.state,
        ...coordinator.tokens,
      });
    }
    for (const a of agents) {
      allTasks.push({
        id: a.id,
        name: a.name,
        role: a.role,
        phase: a.phase || 'unassigned',
        model: a.model,
        state: a.state,
        ...a.tokens,
      });
    }
    const byTask = allTasks.slice().sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
    const byModel = aggregateTokenGroups(allTasks, r => r.actualModel || r.model || 'unknown');
    const byPhase = aggregateTokenGroups(allTasks, r => r.phase || 'unassigned');
    const byRole = aggregateTokenGroups(allTasks, r => r.role || 'misc');

    let totIn = 0, totCache = 0, totOut = 0, totTurns = 0, maxCtxPeak = 0, maxCtxPct = 0, totCost = 0;
    for (const r of allTasks) {
      totIn += r.input;
      totCache += r.cacheRead;
      totOut += r.output;
      totTurns += r.turns;
      if (r.contextPeak > maxCtxPeak) maxCtxPeak = r.contextPeak;
      if (r.contextPct > maxCtxPct) maxCtxPct = r.contextPct;
      totCost += r.estCostUsd;
    }
    const totAll = totIn + totCache + totOut;
    const tokenSummary = {
      totals: {
        input: totIn,
        cacheRead: totCache,
        output: totOut,
        total: totAll,
        turns: totTurns,
        contextPeak: maxCtxPeak,
        maxContextPct: maxCtxPct,
        cacheHitPct: (totIn + totCache) > 0 ? +(totCache / (totIn + totCache) * 100).toFixed(1) : 0,
        estCostUsd: +totCost.toFixed(4),
      },
      byModel,
      byTask,
      byPhase,
      byRole,
    };

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
      coordinator,
      phases,
      agents, counts, progress,
      tokenSummary,
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
        tokenSummary: s.tokenSummary,
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
  const PRESETS_FILE = join(TRK, 'sound-presets.json');

  async function loadSoundPresets() {
    const data = await readJSON(PRESETS_FILE);
    if (Array.isArray(data)) return { presets: data };
    if (data && Array.isArray(data.presets)) return data;
    return { presets: [] };
  }
  async function saveSoundPresets(payloadObj) {
    await fsp.mkdir(TRK, { recursive: true });
    const tmp = PRESETS_FILE + '.tmp' + process.pid;
    await fsp.writeFile(tmp, JSON.stringify(payloadObj, null, 2));
    await fsp.rename(tmp, PRESETS_FILE);
  }
  function readBody(req, limit = 262144) {
    return new Promise((resolveBody, rejectBody) => {
      let size = 0;
      const chunks = [];
      req.on('data', c => {
        size += c.length;
        if (size > limit) { rejectBody(new Error('payload too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
      req.on('error', rejectBody);
    });
  }

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

  function isLocalOrLanHost(h) {
    if (!h) return false;
    const host = h.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    const m172 = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
    if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true;
    return false;
  }

  function isAllowedOrigin(req) {
    const sfs = str(req.headers['sec-fetch-site']).toLowerCase();
    if (sfs === 'cross-site') return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    let u;
    try { u = new URL(origin); } catch { return false; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (req.headers.host && u.host === req.headers.host) return true;
    return isLocalOrLanHost(u.hostname);
  }

  async function listDocEntries() {
    const entries = [];
    const topAllow = ['README.md', 'PROTOCOL.md', 'PLAYBOOK.md'];
    for (const name of topAllow) {
      const p = join(ROOT, name);
      try {
        const st = await fsp.stat(p);
        if (st.isFile() && st.size <= 1048576) {
          const txt = await readText(p);
          const h1 = txt?.match(/^#\s+(.+)$/m)?.[1]?.trim() || name;
          entries.push({ id: name, title: h1, path: name, category: 'Overview', size: st.size });
        }
      } catch { /* missing optional file */ }
    }
    const docsDir = join(ROOT, 'docs');
    for (const d of (await listDir(docsDir)).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!d.isFile() || !d.name.endsWith('.md')) continue;
      const p = join(docsDir, d.name);
      try {
        const st = await fsp.stat(p);
        if (st.size <= 1048576) {
          const txt = await readText(p);
          const h1 = txt?.match(/^#\s+(.+)$/m)?.[1]?.trim() || d.name.replace(/\.md$/, '');
          entries.push({ id: 'docs/' + d.name, title: h1, path: 'docs/' + d.name, category: 'Docs', size: st.size });
        }
      } catch { /* */ }
    }
    return entries;
  }

  const AGY_DB_PATH = resolve(options.agyDbPath || process.env.TRACKER_AGY_DB || join(homedir(), '.gemini', 'antigravity-cli', 'conversation_summaries.db'));
  const AGY_SESSIONS_PY = `
import json, os, sqlite3, sys
from urllib.parse import unquote

db_path = sys.argv[1]
if not os.path.exists(db_path):
    print(json.dumps({"sessions": []}))
    sys.exit(0)

def parse_workspace(raw):
    if not raw:
        return ""
    val = raw.strip()
    if val.startswith("["):
        try:
            arr = json.loads(val)
            val = next((x for x in arr if isinstance(x, str) and x.strip()), "")
        except Exception:
            pass
    if val.startswith("file://"):
        val = unquote(val[7:])
    return val

def make_dir_label(ws):
    if not ws:
        return "(no workspace)"
    marker = "/src/"
    if marker in ws:
        return ws.split(marker, 1)[1].strip("/") or ws
    home = os.path.expanduser("~")
    if ws.startswith(home + "/"):
        return "~/" + ws[len(home) + 1:].strip("/")
    parts = [p for p in ws.strip("/").split("/") if p]
    return "/".join(parts[-2:]) if len(parts) >= 2 else (parts[0] if parts else ws)

try:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=2.0)
    rows = conn.execute("""
        SELECT
            s.conversation_id,
            s.title,
            s.preview,
            s.step_count,
            s.last_modified_time,
            s.workspace_uris,
            s.status,
            s.agent_name,
            COALESCE(NULLIF(s.parent_conversation_id, ''), p.parent_id, '') AS parent_id,
            s.nesting_depth,
            s.not_fully_idle,
            s.group_id
        FROM conversation_summaries s
        LEFT JOIN conversation_parents p ON s.conversation_id = p.conversation_id
        ORDER BY s.last_modified_time DESC
        LIMIT 150
    """).fetchall()
    conn.close()
    sessions = []
    for r in rows:
        ws = parse_workspace(r[5])
        status = r[6] or ""
        sessions.append({
            "conversationId": r[0] or "",
            "title": r[1] or "",
            "preview": r[2] or "",
            "stepCount": int(r[3] or 0),
            "lastModifiedTime": r[4] or "",
            "workspaceUris": r[5] or "",
            "workspace": ws,
            "dirLabel": make_dir_label(ws),
            "status": status,
            "active": status == "CASCADE_RUN_STATUS_RUNNING",
            "agentName": r[7] or "",
            "parentId": r[8] or "",
            "nestingDepth": int(r[9] or 0),
            "notFullyIdle": bool(r[10]),
            "groupId": r[11] or "",
        })
    print(json.dumps({"sessions": sessions}))
except Exception:
    print(json.dumps({"sessions": []}))
`;

  async function loadAgySessions() {
    const updatedAt = new Date().toISOString();
    try {
      await fsp.access(AGY_DB_PATH);
    } catch {
      return { sessions: [], updatedAt };
    }
    try {
      const { stdout } = await execFileAsync('python3', ['-c', AGY_SESSIONS_PY, AGY_DB_PATH], {
        timeout: 5000,
        maxBuffer: 4 * 1024 * 1024,
      });
      const parsed = JSON.parse(stdout || '{}');
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        updatedAt,
      };
    } catch {
      return { sessions: [], updatedAt };
    }
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
        let real, rr;
        try {
          real = await fsp.realpath(abs);
          rr = await fsp.realpath(ROOT);
        } catch {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          return res.end('forbidden');
        }
        if (!['out', 'dist'].some(b => real.startsWith(join(rr, b) + sep))) {
          res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('forbidden');
        }
        const ext = extname(real).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        const secHeaders = { 'X-Content-Type-Options': 'nosniff' };
        if (ext === '.html' || ext === '.htm' || ext === '.svg') secHeaders['Content-Security-Policy'] = 'sandbox';
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
              ...secHeaders,
              'Content-Type': mime,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${end}/${st.size}`,
              'Content-Length': end - start + 1,
              'Cache-Control': 'no-cache',
            });
            const s = createReadStream(real, { start, end });
            s.on('error', () => res.destroy());
            return s.pipe(res);
          }
        }
        res.writeHead(200, {
          ...secHeaders,
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Length': st.size,
          'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        const s = createReadStream(real);
        s.on('error', () => res.destroy());
        return s.pipe(res);
      }

      if (path === '/' || path === '/index.html') {
        const html = await readText(join(DASHBOARD_DIR, 'index.html'));
        res.writeHead(html ? 200 : 503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html || '<h1>index.html missing</h1>');
      }
      if (path === '/sound-studio.js') {
        const js = await readText(join(DASHBOARD_DIR, 'sound-studio.js'));
        res.writeHead(js ? 200 : 404, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(js || '// sound-studio.js missing');
      }
      if (path === '/handbook.js') {
        const js = await readText(join(DASHBOARD_DIR, 'handbook.js'));
        res.writeHead(js ? 200 : 404, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(js || '// handbook.js missing');
      }
      if (path === '/session-tree-panel.js') {
        const js = await readText(join(DASHBOARD_DIR, 'session-tree-panel.js'));
        res.writeHead(js ? 200 : 404, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(js || '// session-tree-panel.js missing');
      }
      if (path === '/api/agy-sessions') {
        const data = await loadAgySessions();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(data));
      }
      if (path === '/api/docs') {
        const docs = await listDocEntries();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ docs }));
      }
      if (rawPath.startsWith('/api/docs/')) {
        let rel = '';
        try { rel = decodeURIComponent(rawPath.slice(10)); } catch { rel = ''; }
        const allowedTop = ['README.md', 'PROTOCOL.md', 'PLAYBOOK.md'];
        const isAllowedRel = allowedTop.includes(rel) || (/^docs\/[a-zA-Z0-9._-]+\.md$/.test(rel) && !rel.includes('..'));
        if (!isAllowedRel || rel.includes('\0')) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'forbidden' }));
        }
        const abs = resolve(ROOT, rel);
        let real, rr;
        try { [real, rr] = await Promise.all([fsp.realpath(abs), fsp.realpath(ROOT)]); }
        catch { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'not found' })); }
        if (!(real === join(rr, rel) || real.startsWith(join(rr, 'docs') + sep))) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'forbidden' }));
        }
        const st = await fsp.stat(real).catch(() => null);
        if (!st || !st.isFile() || st.size > 1048576) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'not found' }));
        }
        const content = await readText(real);
        const title = content?.match(/^#\s+(.+)$/m)?.[1]?.trim() || rel;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ path: rel, title, content }));
      }
      if (path === '/api/sound-presets') {
        if (req.method === 'GET') {
          const data = await loadSoundPresets();
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          return res.end(JSON.stringify(data));
        }
        if (req.method === 'POST') {
          if (!isAllowedOrigin(req)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'Forbidden origin' }));
          }
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw || '{}');
            const cur = await loadSoundPresets();
            let presets = Array.isArray(cur.presets) ? cur.presets : [];
            if (Array.isArray(body.presets)) {
              presets = body.presets
                .filter(p => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim())
                .slice(0, 100);
            } else if (body.preset && typeof body.preset === 'object' && typeof body.preset.name === 'string') {
              const name = body.preset.name.trim();
              presets = presets.filter(p => p.name !== name).concat([{ ...body.preset, name }]);
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ ok: false, error: 'Expected presets array or preset object' }));
            }
            const next = { presets, updatedAt: new Date().toISOString() };
            await saveSoundPresets(next);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            return res.end(JSON.stringify({ ok: true, ...next }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: e?.message || 'invalid json' }));
          }
        }
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
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
        if (!isAllowedOrigin(req)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Forbidden origin' }));
        }
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
        const events = Object.hasOwn(evs, id) ? evs[id] : [];
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ id, events: events.slice(-2000) }));
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
