import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const TRACK_BIN = join(REPO, 'bin', 'track.mjs');
const SERVE_BIN = join(REPO, 'bin', 'serve.mjs');

function rawRequest({ host = '127.0.0.1', port, path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolveReq, rejectReq) => {
    const req = http.request({ host, port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolveReq({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', rejectReq);
    if (body !== null) req.write(body);
    req.end();
  });
}

describe('gantt-swarm-tracker CLI and server', () => {
  let workDir;
  let serverProc;
  let port;

  before(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'gantt-tracker-test-'));

    // 1. Initialize .tracker/plan.json via bin/track.mjs --init
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--init', 'Demo Swarm App'], { encoding: 'utf8' });

    // 2. Log agent events, check, tokens, docs, and phase transitions
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'architect', 'start', 'Designing modules']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'architect', 'progress', '55', 'Writing contracts']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'architect', 'done', 'Contracts complete']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'builder', 'start', '10', 'Implementing core']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--tokens', 'architect', '1200', '3000', '450', '4200', 'claude-opus-4']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--tokens', 'builder', '800', '1200', '300', '2000', 'gpt-oss-120b']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--check', 'build-core', 'pass', 'Compiled clean']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--phase', 'plan', 'done']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--phase', 'build', 'active']);

    // 3. Create sample output artifact in out/ and docs in workDir
    mkdirSync(join(workDir, 'out'), { recursive: true });
    writeFileSync(join(workDir, 'out', 'sample.bin'), '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    writeFileSync(join(workDir, 'README.md'), '# Demo Swarm App\n\nOverview documentation.\n');
    mkdirSync(join(workDir, 'docs'), { recursive: true });
    writeFileSync(join(workDir, 'docs', 'architecture.md'), '# Architecture\n\nModular design.\n');

    // 4. Spawn bin/serve.mjs on an ephemeral port
    port = await new Promise((resolvePort, rejectPort) => {
      serverProc = spawn(process.execPath, [SERVE_BIN, '--root', workDir, '--port', '0', '--host', '127.0.0.1'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let outBuf = '';
      let errBuf = '';
      const timer = setTimeout(() => rejectPort(new Error(`Server start timeout. stdout=${outBuf} stderr=${errBuf}`)), 8000);
      serverProc.stdout.on('data', chunk => {
        outBuf += chunk.toString('utf8');
        const m = /listening on http:\/\/127\.0\.0\.1:(\d+)\//.exec(outBuf);
        if (m) {
          clearTimeout(timer);
          resolvePort(Number(m[1]));
        }
      });
      serverProc.stderr.on('data', chunk => { errBuf += chunk.toString('utf8'); });
      serverProc.once('exit', code => {
        clearTimeout(timer);
        rejectPort(new Error(`Server exited early (${code}). stderr=${errBuf}`));
      });
    });
  });

  after(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
      await new Promise(res => serverProc.once('exit', res));
    }
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it('scaffolds .tracker/plan.json cleanly with --init', () => {
    const plan = JSON.parse(readFileSync(join(workDir, '.tracker', 'plan.json'), 'utf8'));
    assert.equal(plan.project, 'Demo Swarm App');
    assert.ok(Array.isArray(plan.phases) && plan.phases.length >= 4);
    assert.ok(Array.isArray(plan.agents) && plan.agents.length >= 3);
    const planPhase = plan.phases.find(p => p.id === 'plan');
    const buildPhase = plan.phases.find(p => p.id === 'build');
    assert.equal(planPhase.status, 'done');
    assert.equal(buildPhase.status, 'active');
  });

  it('serves /healthz', async () => {
    const res = await rawRequest({ port, path: '/healthz' });
    assert.equal(res.status, 200);
    assert.equal(res.body, 'ok');
  });

  it('serves dashboard HTML without hardcoded project references', async () => {
    const res = await rawRequest({ port, path: '/' });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.ok(res.body.includes('Gantt Swarm Tracker'));
    assert.ok(!/andagy/i.test(res.body));
  });

  it('returns live /api/state reflecting events, checks, and phases', async () => {
    const res = await rawRequest({ port, path: '/api/state' });
    assert.equal(res.status, 200);
    const state = JSON.parse(res.body);
    assert.equal(state.project, 'Demo Swarm App');
    const arch = state.agents.find(a => a.id === 'architect');
    const bld = state.agents.find(a => a.id === 'builder');
    assert.equal(arch.state, 'done');
    assert.equal(arch.pct, 100);
    assert.equal(bld.state, 'running');
    assert.equal(bld.pct, 10);
    assert.equal(state.checks.find(c => c.name === 'build-core')?.status, 'pass');
    assert.equal(state.phases.find(p => p.id === 'plan')?.status, 'done');
  });

  it('returns /api/agent/:id event log', async () => {
    const res = await rawRequest({ port, path: '/api/agent/architect' });
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.id, 'architect');
    assert.equal(data.events.length, 3);
    assert.equal(data.events[2].state, 'done');
  });

  it('returns /api/recording/status and /api/recording/snapshots', async () => {
    const statusRes = await rawRequest({ port, path: '/api/recording/status' });
    assert.equal(statusRes.status, 200);
    const status = JSON.parse(statusRes.body);
    assert.equal(status.recording, false);
    assert.equal(status.frameCount, 0);
    assert.ok(status.snapshotCount >= 1);

    const snapRes = await rawRequest({ port, path: '/api/recording/snapshots' });
    assert.equal(snapRes.status, 200);
    const snapData = JSON.parse(snapRes.body);
    assert.ok(Array.isArray(snapData.snapshots) && snapData.snapshots.length >= 1);
    assert.equal(snapData.snapshots[0].project, 'Demo Swarm App');
  });

  it('supports Range: bytes=0-9 partial content on /files/out/...', async () => {
    const res = await rawRequest({
      port,
      path: '/files/out/sample.bin',
      headers: { Range: 'bytes=0-9' },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers['content-range'], 'bytes 0-9/36');
    assert.equal(res.body, '0123456789');
  });

  it('rejects path traversal attempts on /files/ with 403', async () => {
    const rawTraversal = await rawRequest({ port, path: '/files/../package.json' });
    assert.equal(rawTraversal.status, 403);

    const encodedTraversal = await rawRequest({ port, path: '/files/%2e%2e/package.json' });
    assert.equal(encodedTraversal.status, 403);
  });

  it('serves /sound-studio.js and persists presets via /api/sound-presets', async () => {
    const jsRes = await rawRequest({ port, path: '/sound-studio.js' });
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers['content-type'], /javascript/);
    assert.ok(jsRes.body.includes('SoundStudioEngine'));
    assert.ok(!/andagy/i.test(jsRes.body));

    const emptyRes = await rawRequest({ port, path: '/api/sound-presets' });
    assert.equal(emptyRes.status, 200);
    assert.deepEqual(JSON.parse(emptyRes.body).presets, []);

    const samplePreset = {
      name: 'Test Maqam Mix',
      config: { episode: 'desert_oud', scale: 'maqam_bayati', root: 'D', octave: 3, tempo: 78 },
    };
    const postRes = await rawRequest({
      port,
      path: '/api/sound-presets',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: samplePreset }),
    });
    assert.equal(postRes.status, 200);
    const postData = JSON.parse(postRes.body);
    assert.equal(postData.ok, true);
    assert.equal(postData.presets.length, 1);
    assert.equal(postData.presets[0].name, 'Test Maqam Mix');

    const getRes = await rawRequest({ port, path: '/api/sound-presets' });
    assert.equal(getRes.status, 200);
    const getData = JSON.parse(getRes.body);
    assert.equal(getData.presets.length, 1);
    assert.equal(getData.presets[0].config.scale, 'maqam_bayati');
  });

  it('serves /handbook.js, /api/docs, and rejects docs traversal with 403', async () => {
    const hbRes = await rawRequest({ port, path: '/handbook.js' });
    assert.equal(hbRes.status, 200);
    assert.match(hbRes.headers['content-type'], /javascript/);
    assert.ok(hbRes.body.includes('GanttHandbook'));
    assert.ok(!/andagy/i.test(hbRes.body));

    const idxRes = await rawRequest({ port, path: '/api/docs' });
    assert.equal(idxRes.status, 200);
    const { docs } = JSON.parse(idxRes.body);
    assert.ok(docs.some(d => d.path === 'README.md'));
    assert.ok(docs.some(d => d.path === 'docs/architecture.md'));

    const docRes = await rawRequest({ port, path: '/api/docs/' + encodeURIComponent('docs/architecture.md') });
    assert.equal(docRes.status, 200);
    assert.match(JSON.parse(docRes.body).content, /Modular design/);

    const travRaw = await rawRequest({ port, path: '/api/docs/../package.json' });
    assert.equal(travRaw.status, 403);
    const travEnc = await rawRequest({ port, path: '/api/docs/%2e%2e/package.json' });
    assert.equal(travEnc.status, 403);
  });

  it('aggregates tokenSummary from --tokens with model tier pricing and context windows', async () => {
    const res = await rawRequest({ port, path: '/api/state' });
    assert.equal(res.status, 200);
    const state = JSON.parse(res.body);
    assert.ok(state.tokenSummary && state.tokenSummary.totals);
    const { totals, byModel, byTask, byPhase, byRole } = state.tokenSummary;
    assert.equal(totals.input, 2000);
    assert.equal(totals.cacheRead, 4200);
    assert.equal(totals.output, 750);
    assert.equal(totals.total, 6950);
    assert.ok(totals.estCostUsd > 0);
    assert.ok(byModel.some(m => m.key === 'claude-opus-4' && m.contextWindow === 200000));
    assert.ok(byModel.some(m => m.key === 'gpt-oss-120b' && m.contextWindow === 128000));
    assert.ok(byTask.some(t => t.id === 'architect' && t.total === 4650));
    assert.ok(byPhase.length >= 2);
    assert.ok(byRole.length >= 2);
  });

  it('rejects cross-site Origin on POST routes with 403', async () => {
    const postPresets = await rawRequest({
      port,
      path: '/api/sound-presets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({ preset: { name: 'Bad', config: {} } }),
    });
    assert.equal(postPresets.status, 403);

    const postRender = await rawRequest({
      port,
      path: '/api/recording/render',
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
      },
    });
    assert.equal(postRender.status, 403);
  });

  it('serves /session-tree-panel.js and /api/agy-sessions', async () => {
    const jsRes = await rawRequest({ port, path: '/session-tree-panel.js' });
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers['content-type'], /javascript/);
    assert.ok(jsRes.body.includes('agyTreePanel'));
    assert.ok(!/andagy/i.test(jsRes.body));

    const apiRes = await rawRequest({ port, path: '/api/agy-sessions' });
    assert.equal(apiRes.status, 200);
    assert.match(apiRes.headers['content-type'], /application\/json/);
    const data = JSON.parse(apiRes.body);
    assert.ok(Array.isArray(data.sessions));
    assert.ok(typeof data.updatedAt === 'string');
  });
});
