// Self-mounting Live Machine Antigravity Sessions Tree Panel (Tron 1977)
'use strict';

const STYLE_ID = 'ganttSessionTreeStyles';
const COLLAPSE_KEY = 'gantt_agy_tree_collapsed';
const REFRESH_MS = 10000;

const CSS = `
#agyTreePanel .agy-hd-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto}
#agyTreePanel .agy-search{background:var(--bg2);border:1px solid var(--line2);color:var(--ink);border-radius:4px;padding:4px 8px;font:500 11px/1.2 var(--mono);width:210px;max-width:100%;outline:none}
#agyTreePanel .agy-search:focus{border-color:var(--accent);box-shadow:0 0 8px color-mix(in srgb,var(--accent) 25%,transparent)}
#agyTreePanel .agy-search::placeholder{color:var(--ink3)}
#agyTreePanel.collapsed #agyTreeBody{display:none}
#agyTreePanel.collapsed>.hd{margin-bottom:0}
#agyTreePanel.collapsed .agy-chev{transform:rotate(-90deg)}
.agy-chev{display:inline-block;transition:transform .18s ease;margin-right:4px}

.agy-tree-scroll{max-height:540px;overflow-y:auto;scrollbar-width:thin;display:flex;flex-direction:column;gap:8px;padding-right:2px}
.agy-dir{background:var(--bg2);border:1px solid var(--line);border-radius:5px;overflow:hidden}
.agy-dir.has-active{border-color:color-mix(in srgb,var(--run) 55%,var(--line))}
.agy-dir-hd{display:flex;align-items:center;gap:8px;padding:7px 10px;background:color-mix(in srgb,var(--panel2) 85%,transparent);cursor:pointer;user-select:none;border-bottom:1px solid var(--line)}
.agy-dir.collapsed .agy-dir-hd{border-bottom:0}
.agy-dir.collapsed .agy-dir-body{display:none}
.agy-dir.collapsed .agy-dir-chev{transform:rotate(-90deg)}
.agy-dir-chev{display:inline-block;font-size:10px;color:var(--ink3);transition:transform .15s ease;width:12px;text-align:center}
.agy-dir-name{font:700 12px/1.2 var(--mono);color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agy-dir-meta{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:600 10px/1 var(--mono);color:var(--ink3)}
.agy-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:3px;border:1px solid var(--line);background:var(--panel);color:var(--ink2);font:600 10px/1.1 var(--mono)}
.agy-pill.active{border-color:color-mix(in srgb,var(--run) 60%,transparent);color:var(--run);background:rgba(255,159,28,.12)}
.agy-pill.sub{border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
.agy-pill.agent{border-color:color-mix(in srgb,var(--tabby) 45%,transparent);color:var(--tabby);background:rgba(255,159,28,.1)}

.agy-dir-body{padding:4px 8px 6px}
.agy-node{position:relative}
.agy-children{position:relative;margin-left:16px;padding-left:12px;border-left:1px dashed var(--line2)}
.agy-children>.agy-node::before{content:"";position:absolute;left:-12px;top:14px;width:10px;border-top:1px dashed var(--line2)}

.agy-row{display:flex;align-items:center;gap:7px;padding:5px 7px;margin:2px 0;border-radius:4px;border:1px solid transparent;cursor:pointer;transition:background .15s,border-color .15s;min-width:0}
.agy-row:hover{background:color-mix(in srgb,var(--accent) 7%,var(--panel));border-color:var(--line)}
.agy-row.expanded{background:color-mix(in srgb,var(--accent) 9%,var(--panel));border-color:var(--line2)}
.agy-exp{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font:700 10px/1 var(--mono);color:var(--ink3);background:transparent;border:1px solid var(--line);border-radius:3px;cursor:pointer;flex:none;padding:0}
.agy-exp:hover{color:var(--accent);border-color:var(--accent)}
.agy-exp.leaf{border-color:transparent;cursor:default;opacity:.35}
.agy-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--queued)}
.agy-dot.active{background:var(--run);box-shadow:0 0 0 0 rgba(255,159,28,.65);animation:agyPulse 1.3s ease-in-out infinite}
@keyframes agyPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,159,28,.65)}50%{box-shadow:0 0 0 4px rgba(255,159,28,0)}}
.agy-title{font:600 11.5px/1.3 var(--mono);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.agy-title.muted{color:var(--ink2);font-weight:500}
.agy-badges{display:flex;align-items:center;gap:5px;flex:none;flex-wrap:wrap}
.agy-time{font:500 10px/1 var(--mono);color:var(--ink3);white-space:nowrap;min-width:54px;text-align:right}

.agy-detail{margin:2px 0 6px 21px;padding:8px 10px;background:var(--panel);border:1px solid var(--line);border-left:2px solid var(--accent);border-radius:0 4px 4px 0;font:400 11px/1.45 var(--mono);color:var(--ink2)}
.agy-detail-grid{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:5px;font-size:10.5px;color:var(--ink3)}
.agy-detail-grid b{color:var(--ink)}
.agy-preview{white-space:pre-wrap;word-break:break-word;color:var(--ink2);background:var(--bg);border:1px solid var(--line);border-radius:3px;padding:6px 8px;max-height:140px;overflow-y:auto;font-size:10.5px}

@media (max-width:780px){
  #agyTreePanel .agy-search{width:100%}
  .agy-time{display:none}
}
`;

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function fmtRelTime(raw) {
  if (!raw) return '—';
  const normalized = String(raw).replace(' ', 'T').replace(/\+(\d{2}):(\d{2})$/, '+$1:$2');
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) return String(raw).slice(0, 16);
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function parseTs(raw) {
  if (!raw) return 0;
  const ms = Date.parse(String(raw).replace(' ', 'T'));
  return Number.isFinite(ms) ? ms : 0;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

function findInsertAnchor(wrap) {
  const galleryEl = document.getElementById('gallery');
  if (galleryEl) {
    const galleryPanel = galleryEl.closest('section.panel');
    if (galleryPanel && galleryPanel.parentNode === wrap) return galleryPanel;
  }
  const tokPanel = document.getElementById('tokPanel');
  if (tokPanel && tokPanel.parentNode === wrap) return tokPanel.nextSibling;
  return null;
}

function buildPanelHtml() {
  return `
    <div class="hd">
      <button class="btn" id="agyTreeToggle" aria-expanded="true" aria-controls="agyTreeBody">
        <span class="agy-chev">▾</span><span id="agyTreeToggleTxt">COLLAPSE</span>
      </button>
      <h2>Live Machine Sessions Tree<span class="sub" id="agyTreeSub">loading…</span></h2>
      <div class="gantt-telemetry" id="agyTreeTelemetry">
        DIRS <b id="agyDirCnt">0</b> · ROOTS <b id="agyRootCnt">0</b> · ACTIVE <b id="agyActiveCnt">0</b> · SUBS <b id="agySubCnt">0</b>
      </div>
      <div class="agy-hd-controls">
        <div class="tabs" id="agyFilterTabs">
          <button class="btn on" data-f="all">ALL</button>
          <button class="btn" data-f="active">ACTIVE</button>
          <button class="btn" data-f="top">TOP-LEVEL</button>
        </div>
        <input class="agy-search" id="agySearch" type="search" placeholder="Filter title, dir, agent, id…" aria-label="Filter Antigravity sessions">
        <button class="btn" id="agyRefreshBtn" title="Refresh local machine sessions">↻ REFRESH</button>
      </div>
    </div>
    <div id="agyTreeBody">
      <div class="agy-tree-scroll" id="agyTreeList">
        <div class="empty"><b>Loading live machine sessions…</b>Querying local conversation_summaries.db</div>
      </div>
    </div>
  `;
}

function createState() {
  return {
    sessions: [],
    updatedAt: null,
    filter: 'all',
    query: '',
    collapsedDirs: new Set(),
    expandedDirs: new Set(),
    collapsedNodes: new Set(),
    expandedDetails: new Set(),
    isSearchFocused: false,
    loading: false,
  };
}

function buildForest(sessions) {
  const byId = new Map();
  for (const s of sessions) {
    byId.set(s.conversationId, { ...s, children: [], ts: parseTs(s.lastModifiedTime) });
  }
  const roots = [];
  for (const node of byId.values()) {
    const pid = node.parentId;
    if (pid && pid !== node.conversationId && byId.has(pid)) {
      byId.get(pid).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = list => {
    list.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.ts - a.ts;
    });
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);

  const annotate = node => {
    let subCount = 0;
    let activeBranch = !!node.active;
    for (const ch of node.children) {
      annotate(ch);
      subCount += 1 + ch.subCount;
      if (ch.activeBranch) activeBranch = true;
    }
    node.subCount = subCount;
    node.activeBranch = activeBranch;
  };
  for (const r of roots) annotate(r);

  const dirMap = new Map();
  for (const r of roots) {
    const key = r.dirLabel || '(no workspace)';
    if (!dirMap.has(key)) {
      dirMap.set(key, {
        dirLabel: key,
        workspace: r.workspace || '',
        roots: [],
        activeCount: 0,
        subCount: 0,
        latestTs: 0,
      });
    }
    const g = dirMap.get(key);
    g.roots.push(r);
    if (r.active) g.activeCount += 1;
    const countActiveSubs = n => n.children.reduce((acc, c) => acc + (c.active ? 1 : 0) + countActiveSubs(c), 0);
    g.activeCount += countActiveSubs(r);
    g.subCount += r.subCount;
    if (r.ts > g.latestTs) g.latestTs = r.ts;
  }

  const dirs = Array.from(dirMap.values());
  dirs.sort((a, b) => {
    if ((a.activeCount > 0) !== (b.activeCount > 0)) return a.activeCount > 0 ? -1 : 1;
    return b.latestTs - a.latestTs;
  });
  return dirs;
}

function matchesQuery(node, q) {
  if (!q) return true;
  const hay = [
    node.title,
    node.preview,
    node.workspace,
    node.dirLabel,
    node.agentName,
    node.conversationId,
    node.status,
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function filterNode(node, filterMode, q) {
  const selfMatches = matchesQuery(node, q);
  if (filterMode === 'top') {
    if (filterMode === 'top' && q && !selfMatches && !node.children.some(c => matchesQuery(c, q))) return null;
    return { ...node, children: [] };
  }
  const filteredChildren = node.children
    .map(ch => filterNode(ch, filterMode, q))
    .filter(Boolean);

  if (filterMode === 'active') {
    const keepSelf = node.active && selfMatches;
    if (keepSelf || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  if (selfMatches || filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }
  return null;
}

function renderNodeHtml(node, state, depth = 0) {
  const hasKids = node.children.length > 0;
  const isNodeCollapsed = state.collapsedNodes.has(node.conversationId);
  const isDetailOpen = state.expandedDetails.has(node.conversationId);
  const displayTitle = node.title
    ? node.title
    : (node.agentName ? `${node.agentName} subagent` : `Session ${node.conversationId.slice(0, 8)}`);
  const isMutedTitle = !node.title;

  const badges = [];
  if (node.agentName) badges.push(`<span class="agy-pill agent">${escHtml(node.agentName)}</span>`);
  if (node.active) badges.push(`<span class="agy-pill active">RUNNING</span>`);
  if (node.subCount > 0) {
    badges.push(`<span class="agy-pill sub">+${node.subCount} subagent${node.subCount === 1 ? '' : 's'}</span>`);
  }
  badges.push(`<span class="agy-pill">${Number(node.stepCount || 0)} steps</span>`);

  const detailHtml = isDetailOpen ? `
    <div class="agy-detail">
      <div class="agy-detail-grid">
        <span><b>ID:</b> ${escHtml(node.conversationId)}</span>
        <span><b>STATUS:</b> ${escHtml(node.status || 'IDLE')}</span>
        <span><b>DEPTH:</b> ${Number(node.nestingDepth || 0)}</span>
        ${node.parentId ? `<span><b>PARENT:</b> ${escHtml(node.parentId.slice(0, 12))}…</span>` : ''}
        ${node.workspace ? `<span><b>WORKSPACE:</b> ${escHtml(node.workspace)}</span>` : ''}
      </div>
      ${node.preview ? `<div class="agy-preview">${escHtml(node.preview)}</div>` : '<div style="color:var(--ink3);font-style:italic">No preview text recorded</div>'}
    </div>
  ` : '';

  const childrenHtml = hasKids && !isNodeCollapsed
    ? `<div class="agy-children">${node.children.map(ch => renderNodeHtml(ch, state, depth + 1)).join('')}</div>`
    : '';

  return `
    <div class="agy-node" data-id="${escHtml(node.conversationId)}">
      <div class="agy-row ${isDetailOpen ? 'expanded' : ''}" data-row-id="${escHtml(node.conversationId)}">
        <button class="agy-exp ${hasKids ? '' : 'leaf'}" data-toggle-node="${escHtml(node.conversationId)}" aria-label="Toggle subagents" ${hasKids ? '' : 'tabindex="-1"'}>${hasKids ? (isNodeCollapsed ? '▸' : '▾') : '·'}</button>
        <span class="agy-dot ${node.active ? 'active' : ''}" title="${escHtml(node.status || '')}"></span>
        <span class="agy-title ${isMutedTitle ? 'muted' : ''}" title="${escHtml(displayTitle)}">${escHtml(displayTitle)}</span>
        <span class="agy-badges">${badges.join('')}</span>
        <span class="agy-time">${escHtml(fmtRelTime(node.lastModifiedTime))}</span>
      </div>
      ${detailHtml}
      ${childrenHtml}
    </div>
  `;
}

function renderTree(state) {
  const listEl = document.getElementById('agyTreeList');
  if (!listEl) return;

  const dirs = buildForest(state.sessions);
  const q = state.query.trim().toLowerCase();

  let totalRoots = 0;
  let totalActive = 0;
  let totalSubs = 0;
  for (const s of state.sessions) {
    if (s.active) totalActive += 1;
  }
  for (const d of dirs) {
    totalRoots += d.roots.length;
    totalSubs += d.subCount;
  }

  document.getElementById('agyDirCnt').textContent = String(dirs.length);
  document.getElementById('agyRootCnt').textContent = String(totalRoots);
  document.getElementById('agyActiveCnt').textContent = String(totalActive);
  document.getElementById('agySubCnt').textContent = String(totalSubs);
  const subEl = document.getElementById('agyTreeSub');
  if (subEl) {
    subEl.textContent = state.sessions.length
      ? `${state.sessions.length} recent · refreshed ${fmtRelTime(state.updatedAt)}`
      : 'no local sessions found';
  }

  const visibleDirs = [];
  for (const d of dirs) {
    const filteredRoots = d.roots.map(r => filterNode(r, state.filter, q)).filter(Boolean);
    if (filteredRoots.length > 0) {
      visibleDirs.push({ ...d, roots: filteredRoots });
    }
  }

  if (!visibleDirs.length) {
    listEl.innerHTML = state.sessions.length
      ? '<div class="empty"><b>No matching sessions</b>Try switching filter to ALL or clearing search</div>'
      : '<div class="empty"><b>No Antigravity sessions available</b>~/.gemini/antigravity-cli/conversation_summaries.db missing or empty</div>';
    return;
  }

  listEl.innerHTML = visibleDirs.map((d, idx) => {
    const autoExpanded = d.activeCount > 0 || idx < 3 || !!q || state.filter === 'active';
    const isCollapsed = state.collapsedDirs.has(d.dirLabel) || (!autoExpanded && !state.expandedDirs.has(d.dirLabel));
    return `
      <div class="agy-dir ${isCollapsed ? 'collapsed' : ''} ${d.activeCount > 0 ? 'has-active' : ''}" data-dir="${escHtml(d.dirLabel)}">
        <div class="agy-dir-hd" data-toggle-dir="${escHtml(d.dirLabel)}" title="${escHtml(d.workspace || d.dirLabel)}">
          <span class="agy-dir-chev">▾</span>
          <span>📁</span>
          <span class="agy-dir-name">${escHtml(d.dirLabel)}</span>
          <div class="agy-dir-meta">
            ${d.activeCount > 0 ? `<span class="agy-pill active">${d.activeCount} active</span>` : ''}
            <span class="agy-pill">${d.roots.length} top-level</span>
            ${d.subCount > 0 ? `<span class="agy-pill sub">${d.subCount} subagents</span>` : ''}
          </div>
        </div>
        <div class="agy-dir-body">
          ${d.roots.map(r => renderNodeHtml(r, state, 0)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function mount() {
  const wrap = document.querySelector('.wrap');
  if (!wrap || document.getElementById('agyTreePanel')) return;

  injectStyles();

  const panel = document.createElement('section');
  panel.className = 'panel mb';
  panel.id = 'agyTreePanel';
  panel.innerHTML = buildPanelHtml();

  const anchor = findInsertAnchor(wrap);
  if (anchor) wrap.insertBefore(panel, anchor);
  else wrap.appendChild(panel);

  const state = createState();

  const applyCollapse = collapsed => {
    panel.classList.toggle('collapsed', collapsed);
    const btn = document.getElementById('agyTreeToggle');
    const txt = document.getElementById('agyTreeToggleTxt');
    if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
    if (txt) txt.textContent = collapsed ? 'EXPAND' : 'COLLAPSE';
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* */ }
  };

  try {
    if (localStorage.getItem(COLLAPSE_KEY) === '1') applyCollapse(true);
  } catch { /* */ }

  document.getElementById('agyTreeToggle')?.addEventListener('click', () => {
    applyCollapse(!panel.classList.contains('collapsed'));
  });

  document.getElementById('agyFilterTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-f]');
    if (!btn) return;
    document.querySelectorAll('#agyFilterTabs button').forEach(b => b.classList.toggle('on', b === btn));
    state.filter = btn.getAttribute('data-f') || 'all';
    renderTree(state);
  });

  const searchInput = document.getElementById('agySearch');
  searchInput?.addEventListener('focus', () => { state.isSearchFocused = true; });
  searchInput?.addEventListener('blur', () => { state.isSearchFocused = false; });
  searchInput?.addEventListener('input', e => {
    state.query = e.target.value || '';
    renderTree(state);
  });

  document.getElementById('agyTreeList')?.addEventListener('click', e => {
    const dirHd = e.target.closest('[data-toggle-dir]');
    if (dirHd) {
      const dir = dirHd.getAttribute('data-toggle-dir');
      const dirCard = dirHd.closest('.agy-dir');
      const currentlyCollapsed = dirCard?.classList.contains('collapsed');
      if (currentlyCollapsed) {
        state.collapsedDirs.delete(dir);
        state.expandedDirs.add(dir);
      } else {
        state.expandedDirs.delete(dir);
        state.collapsedDirs.add(dir);
      }
      renderTree(state);
      return;
    }

    const nodeToggle = e.target.closest('[data-toggle-node]');
    if (nodeToggle && !nodeToggle.classList.contains('leaf')) {
      e.stopPropagation();
      const id = nodeToggle.getAttribute('data-toggle-node');
      if (state.collapsedNodes.has(id)) state.collapsedNodes.delete(id);
      else state.collapsedNodes.add(id);
      renderTree(state);
      return;
    }

    const row = e.target.closest('[data-row-id]');
    if (row) {
      const id = row.getAttribute('data-row-id');
      if (state.expandedDetails.has(id)) state.expandedDetails.delete(id);
      else state.expandedDetails.add(id);
      renderTree(state);
    }
  });

  async function fetchSessions(force = false) {
    if (state.loading) return;
    if (!force && (state.isSearchFocused || state.expandedDetails.size > 0 || document.hidden)) return;
    state.loading = true;
    try {
      const r = await fetch('/api/agy-sessions', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
      state.updatedAt = data.updatedAt || new Date().toISOString();
      renderTree(state);
    } catch (err) {
      const sub = document.getElementById('agyTreeSub');
      if (sub) sub.textContent = `fetch error (${err?.message || 'offline'})`;
    } finally {
      state.loading = false;
    }
  }

  document.getElementById('agyRefreshBtn')?.addEventListener('click', () => fetchSessions(true));
  fetchSessions(true);
  setInterval(() => fetchSessions(false), REFRESH_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
