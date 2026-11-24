#!/usr/bin/env node
// Gantt Swarm Tracker CLI progress reporter & initializer.
//   gantt-track [--root <dir>] --init [projectName]
//   gantt-track [--root <dir>] <agentId> <start|progress|done|blocked|failed|note> [pct 0-100] "<message>"
//   gantt-track [--root <dir>] --check <name> <pass|fail|running|skip> "<detail>"
//   gantt-track [--root <dir>] --phase <phaseId> <pending|active|done>
import { mkdirSync, appendFileSync, writeFileSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const STATES = ['start', 'progress', 'done', 'blocked', 'failed', 'note'];
const CHECKS = ['pass', 'fail', 'running', 'skip'];
const PHASES = ['pending', 'active', 'done'];

function usage(msg, code = 2) {
  const out = code === 0 ? console.log : console.error;
  if (msg) out(msg);
  out(`usage:
  gantt-track [--root <dir>] --init [projectName] [--force]
  gantt-track [--root <dir>] <agentId> <${STATES.join('|')}> [pct] "<msg>"
  gantt-track [--root <dir>] --check <name> <${CHECKS.join('|')}> "<detail>"
  gantt-track [--root <dir>] --phase <phaseId> <${PHASES.join('|')}>`);
  process.exit(code);
}

const rawArgs = process.argv.slice(2);
let rootOpt = null;
let force = false;
const args = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--root' && i + 1 < rawArgs.length) rootOpt = rawArgs[++i];
  else if (a.startsWith('--root=')) rootOpt = a.slice(7);
  else if (a === '--force') force = true;
  else if (a === '--help' || a === '-h') usage('', 0);
  else args.push(a);
}

const root = resolve(rootOpt || process.env.TRACKER_ROOT || process.cwd());
const t = new Date().toISOString();

if (args[0] === '--init') {
  const projectName = args.slice(1).join(' ').trim() || basename(root) || 'Swarm Project';
  const trkDir = join(root, '.tracker');
  const planPath = join(trkDir, 'plan.json');
  mkdirSync(join(trkDir, 'events'), { recursive: true });
  mkdirSync(join(trkDir, 'checks'), { recursive: true });
  if (existsSync(planPath) && !force) {
    console.log(`already initialized: ${planPath} (pass --force to overwrite)`);
    process.exit(0);
  }
  const plan = {
    project: projectName,
    tagline: 'Parallel multi-agent swarm execution tracker',
    startedAt: t,
    appUrl: '',
    appLabel: '',
    phases: [
      { id: 'plan', name: 'Planning & Design', status: 'active', startedAt: t },
      { id: 'build', name: 'Parallel Implementation', status: 'pending' },
      { id: 'verify', name: 'Verification & QA', status: 'pending' },
      { id: 'ship', name: 'Package & Release', status: 'pending' },
    ],
    agents: [
      {
        id: 'architect',
        name: 'System Architect',
        role: 'tooling',
        model: 'opus',
        phase: 'plan',
        wave: 1,
        desc: 'Design architecture and module contracts',
        owns: ['src'],
      },
      {
        id: 'builder',
        name: 'Core Builder',
        role: 'backend',
        model: 'sonnet',
        phase: 'build',
        wave: 2,
        desc: 'Implement core functionality',
        owns: ['src'],
      },
      {
        id: 'verifier',
        name: 'Test & QA Engineer',
        role: 'qa',
        model: 'haiku',
        phase: 'verify',
        wave: 3,
        desc: 'Execute automated test suite',
        owns: ['test'],
      },
    ],
  };
  const tmp = planPath + '.tmp.' + process.pid;
  writeFileSync(tmp, JSON.stringify(plan, null, 2) + '\n');
  renameSync(tmp, planPath);
  console.log(`initialized ${planPath} for "${projectName}"`);
} else if (args[0] === '--check') {
  const [, name, status, ...rest] = args;
  if (!name || !CHECKS.includes(status)) usage('bad check');
  mkdirSync(join(root, '.tracker/checks'), { recursive: true });
  writeFileSync(
    join(root, '.tracker/checks', name.replace(/[^\w.-]/g, '_') + '.json'),
    JSON.stringify({ name, status, detail: rest.join(' '), t }) + '\n',
  );
} else if (args[0] === '--phase') {
  const [, phaseId, status] = args;
  if (!phaseId || !PHASES.includes(status)) usage('bad phase');
  const planPath = join(root, '.tracker/plan.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const ph = (plan.phases || []).find(p => p.id === phaseId);
  if (!ph) usage('unknown phase: ' + phaseId);
  ph.status = status;
  if (status === 'active' && !ph.startedAt) ph.startedAt = t;
  if (status === 'done') {
    if (!ph.startedAt) ph.startedAt = t;
    ph.endedAt = t;
  }
  const tmp = planPath + '.tmp.' + process.pid;
  writeFileSync(tmp, JSON.stringify(plan, null, 2) + '\n');
  renameSync(tmp, planPath);
} else {
  const [agent, state, ...rest] = args;
  if (!agent || !STATES.includes(state)) usage('bad event');
  let pct = null;
  if (rest.length > 0 && /^\d{1,3}$/.test(rest[0])) pct = Math.min(100, Number(rest.shift()));
  if (state === 'done') pct = 100;
  if (state === 'start' && pct === null) pct = 0;
  mkdirSync(join(root, '.tracker/events'), { recursive: true });
  appendFileSync(
    join(root, '.tracker/events', agent.replace(/[^\w.-]/g, '_') + '.jsonl'),
    JSON.stringify({ t, agent, state, pct, msg: rest.join(' ') }) + '\n',
  );
}
