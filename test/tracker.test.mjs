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

function rawRequest({ host = '127.0.0.1', port, path, method = 'GET', headers = {} }) {
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

    // 2. Log agent events, check, and phase transitions
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'architect', 'start', 'Designing modules']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'architect', 'progress', '55', 'Writing contracts']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'architect', 'done', 'Contracts complete']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, 'builder', 'start', '10', 'Implementing core']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--check', 'build-core', 'pass', 'Compiled clean']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--phase', 'plan', 'done']);
    execFileSync(process.execPath, [TRACK_BIN, '--root', workDir, '--phase', 'build', 'active']);

    // 3. Create sample output artifact in out/ for Range request testing
    mkdirSync(join(workDir, 'out'), { recursive: true });
    writeFileSync(join(workDir, 'out', 'sample.bin'), '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');

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
});
