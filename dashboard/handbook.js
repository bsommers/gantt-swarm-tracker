// Self-mounting Book / Handbook Reader & Interactive Help Guide (Tron 1977)
'use strict';

const STYLE_ID = 'ganttHandbookStyles';

const CSS = `
/* Book / Handbook Reader & Help Guide Modals */
.hb-modal{width:min(1120px,96vw);height:min(86vh,820px);display:flex;flex-direction:column}
.hb-help-modal{width:min(940px,96vw);max-height:86vh;display:flex;flex-direction:column}
.hb-badge{font:800 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:3px;border:1px solid var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.hb-book-body{display:grid;grid-template-columns:280px minmax(0,1fr);flex:1;min-height:0;overflow:hidden}
@media (max-width:780px){.hb-book-body{grid-template-columns:1fr;grid-template-rows:220px minmax(0,1fr)}}

.hb-side{border-right:1px solid var(--line);background:var(--bg2);display:flex;flex-direction:column;min-height:0;overflow:hidden}
@media (max-width:780px){.hb-side{border-right:0;border-bottom:1px solid var(--line)}}
.hb-search-wrap{padding:10px;border-bottom:1px solid var(--line)}
.hb-search{width:100%;background:var(--panel);border:1px solid var(--line2);color:var(--ink);border-radius:4px;padding:6px 9px;font:500 11.5px var(--mono);outline:none}
.hb-search:focus{border-color:var(--accent);box-shadow:0 0 8px color-mix(in srgb,var(--accent) 25%,transparent)}
.hb-chapters{flex:1;overflow-y:auto;padding:8px;scrollbar-width:thin}
.hb-cat{font:700 9.5px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin:10px 6px 6px}
.hb-cat:first-child{margin-top:2px}
.hb-ch{width:100%;text-align:left;background:transparent;border:1px solid transparent;border-radius:4px;padding:7px 9px;margin-bottom:3px;cursor:pointer;color:var(--ink2);font:500 11.5px/1.3 var(--mono);display:flex;flex-direction:column;gap:2px;transition:border-color .15s,background .15s}
.hb-ch:hover{border-color:var(--line2);background:color-mix(in srgb,var(--accent) 7%,transparent);color:var(--ink)}
.hb-ch.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--panel));color:var(--ink);box-shadow:0 0 10px color-mix(in srgb,var(--accent) 18%,transparent)}
.hb-ch-t{font-weight:700;color:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hb-ch-p{font-size:10px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.hb-main{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--panel)}
.hb-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel2)}
.hb-bar-title{font:700 13px/1.2 var(--sans);color:var(--ink);margin-right:4px}
.hb-pill{font:600 10px/1 var(--mono);color:var(--ink2);background:var(--bg2);border:1px solid var(--line);border-radius:3px;padding:4px 7px}
.hb-nav{margin-left:auto;display:flex;gap:6px;align-items:center}
.hb-nav .btn:disabled{opacity:.4;cursor:not-allowed}

.hb-read{flex:1;overflow-y:auto;padding:18px 24px 28px;scrollbar-width:thin;color:var(--ink);font:400 13px/1.65 var(--mono)}
.hb-md h1,.hb-md h2,.hb-md h3,.hb-md h4{font-family:var(--sans);color:var(--accent);letter-spacing:.04em;margin:1.25em 0 .5em;line-height:1.25;text-transform:none}
.hb-md h1{font-size:20px;border-bottom:1px solid var(--line2);padding-bottom:6px;margin-top:0}
.hb-md h2{font-size:16px;border-bottom:1px dashed var(--line);padding-bottom:4px}
.hb-md h2::before{content:none}
.hb-md h3{font-size:14px;color:var(--tabby)}
.hb-md h4{font-size:12.5px;color:var(--ink)}
.hb-md p{margin:.65em 0;color:var(--ink2)}
.hb-md strong{color:var(--ink);font-weight:700}
.hb-md em{color:var(--ink);font-style:italic}
.hb-md a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
.hb-md a:hover{color:var(--tabby)}
.hb-md ul,.hb-md ol{margin:.55em 0 .75em;padding-left:22px;color:var(--ink2)}
.hb-md li{margin:.25em 0}
.hb-md hr{border:0;border-top:1px dashed var(--line2);margin:1.3em 0}
.hb-md blockquote{margin:.8em 0;padding:8px 14px;border-left:3px solid var(--tabby);background:color-mix(in srgb,var(--tabby) 8%,var(--bg2));color:var(--ink2);border-radius:0 4px 4px 0}
.hb-md code{font-family:var(--mono);font-size:11.5px;background:var(--bg2);border:1px solid var(--line);color:var(--accent);padding:1px 5px;border-radius:3px}
.hb-code-wrap{position:relative;margin:.85em 0;background:var(--bg);border:1px solid var(--line2);border-radius:5px;overflow:hidden}
.hb-code-hd{display:flex;align-items:center;justify-content:space-between;padding:4px 10px;background:var(--bg2);border-bottom:1px solid var(--line);font:700 10px/1 var(--mono);color:var(--ink3);text-transform:uppercase}
.hb-copy{padding:3px 7px;font-size:9.5px}
.hb-code-wrap pre{margin:0;padding:11px 13px;overflow-x:auto;font:400 11.5px/1.5 var(--mono);color:var(--ink)}
.hb-code-wrap pre code{background:transparent;border:0;padding:0;color:inherit;font-size:inherit}
.hb-md table{width:100%;border-collapse:collapse;margin:.9em 0;font:500 11.5px/1.4 var(--mono)}
.hb-md th,.hb-md td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}
.hb-md th{background:var(--bg2);color:var(--accent);font-weight:700}
.hb-md tr:nth-child(even) td{background:color-mix(in srgb,var(--bg2) 45%,transparent)}

/* Help Modal */
.hb-tabs{display:flex;gap:6px;padding:10px 18px 0;border-bottom:1px solid var(--line);background:var(--bg2);flex-wrap:wrap}
.hb-tab{background:transparent;border:1px solid transparent;border-bottom:2px solid transparent;color:var(--ink3);font:700 11px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;padding:9px 12px;cursor:pointer;border-radius:4px 4px 0 0}
.hb-tab:hover{color:var(--ink)}
.hb-tab.on{color:var(--accent);border-color:var(--line);border-bottom-color:var(--accent);background:var(--panel)}
.hb-help-pane{padding:16px 20px 22px;overflow-y:auto;flex:1;scrollbar-width:thin}
.hb-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}
.hb-card{background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:11px 13px}
.hb-card h4{margin:0 0 6px;font:700 11.5px/1.2 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.hb-card p,.hb-card ul{margin:0;font:400 11.5px/1.5 var(--mono);color:var(--ink2)}
.hb-card ul{padding-left:16px;margin-top:4px}
.hb-card code{font:600 11px var(--mono);color:var(--tabby)}
.hb-kbd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
.hb-kbd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:5px;font:500 11.5px var(--mono);color:var(--ink2)}
.hb-kbd{display:inline-block;min-width:28px;text-align:center;padding:3px 8px;border-radius:4px;background:var(--panel2);border:1px solid var(--line2);color:var(--accent);font:700 11px/1.2 var(--mono);box-shadow:0 2px 0 var(--line)}
.hb-pre{margin:8px 0 12px;padding:10px 12px;background:var(--bg);border:1px solid var(--line2);border-radius:5px;overflow-x:auto;font:400 11.5px/1.5 var(--mono);color:var(--ink)}
.hb-sec-title{font:700 11px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--tabby);margin:14px 0 6px}
.hb-sec-title:first-child{margin-top:0}
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

function unescEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizeHref(rawEscapedUrl) {
  const raw = unescEntities(rawEscapedUrl).trim();
  if (!raw) return '#';
  const normalized = raw.replace(/[\u0000-\u0020]+/g, '');
  if (/^(?:javascript|data|vbscript):/i.test(normalized)) return '#';
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized);
  if (scheme && !/^(?:https?|mailto)$/i.test(scheme[1])) return '#';
  return escHtml(raw);
}

function formatInline(escapedText) {
  const codeTokens = [];
  let s = escapedText.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code>${code}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g, (_, label, target) => {
    const urlPart = target.replace(/\s+&quot;.*&quot;$/, '');
    const href = sanitizeHref(urlPart);
    const external = /^https?:\/\//i.test(unescEntities(href));
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${attrs}>${label}</a>`;
  });

  // Bold & italic
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');

  return s.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeTokens[Number(i)]);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
}

function splitTableRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map(c => c.trim());
}

function renderMarkdown(md) {
  // MUST escape HTML entities FIRST before any formatting
  const escaped = escHtml(String(md ?? '')).replace(/\r\n?/g, '\n');

  // Extract fenced code blocks into placeholders so inner lines aren't parsed as MD
  const codeBlocks = [];
  const withPlaceholders = escaped.replace(
    /^```([a-zA-Z0-9_+-]*)\n([\s\S]*?)^```[ \t]*$/gm,
    (_, lang, code) => {
      const idx = codeBlocks.length;
      const label = lang ? lang : 'code';
      codeBlocks.push(
        `<div class="hb-code-wrap">` +
          `<div class="hb-code-hd"><span>${label}</span>` +
          `<button type="button" class="btn hb-copy" data-copy-code="${idx}">COPY</button></div>` +
          `<pre><code>${code.replace(/\n$/, '')}</code></pre>` +
        `</div>`
      );
      return `\u0000BLOCK${idx}\u0000`;
    }
  );

  const lines = withPlaceholders.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block placeholder
    const bm = /^\u0000BLOCK(\d+)\u0000$/.exec(line.trim());
    if (bm) {
      out.push(codeBlocks[Number(bm[1])]);
      i++;
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(?:---+|===+|\*\*\*+)\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Headings # / ## / ### / ####
    const hm = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (hm) {
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${formatInline(hm[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // GFM table
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const thead = '<thead><tr>' + headers.map(h => `<th>${formatInline(h)}</th>`).join('') + '</tr></thead>';
      const tbody = rows.length
        ? '<tbody>' + rows.map(r =>
            '<tr>' + headers.map((_, ci) => `<td>${formatInline(r[ci] ?? '')}</td>`).join('') + '</tr>'
          ).join('') + '</tbody>'
        : '';
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Blockquote (escaped '>' is '&gt;')
    if (/^\s*&gt;\s?/.test(line)) {
      const bqLines = [];
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^\s*&gt;\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${bqLines.map(formatInline).join('<br>')}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${formatInline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${formatInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph: collect contiguous non-special lines
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\u0000BLOCK\d+\u0000$/.test(lines[i].trim()) &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*(?:---+|===+|\*\*\*+)\s*$/.test(lines[i]) &&
      !/^\s*&gt;\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(formatInline(lines[i]));
      i++;
    }
    if (para.length) {
      out.push(`<p>${para.join(' ')}</p>`);
    }
  }

  return out.join('\n');
}

// ---------- State & DOM Helpers ----------

let mounted = false;
let docsIndex = [];
let activePath = null;
let docCache = new Map();
let searchQuery = '';
let helpTab = 'guide';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function createButtons() {
  const kicker = document.querySelector('.brand .kicker');
  if (!kicker) return;
  if (document.getElementById('openBookBtn') || document.getElementById('openHelpBtn')) return;

  const bookBtn = document.createElement('button');
  bookBtn.type = 'button';
  bookBtn.className = 'btn';
  bookBtn.id = 'openBookBtn';
  bookBtn.title = 'Project Book & Documentation Reader (B)';
  bookBtn.textContent = '📖 BOOK';
  bookBtn.addEventListener('click', () => openBook());

  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'btn';
  helpBtn.id = 'openHelpBtn';
  helpBtn.title = 'Tracker Help & Keyboard Shortcuts (?)';
  helpBtn.textContent = '❓ HELP';
  helpBtn.addEventListener('click', () => openHelp());

  const anchor =
    kicker.querySelector('#openSoundStudioBtn') ||
    kicker.querySelector('#soundStudioBtn') ||
    kicker.querySelector('#openReplayBtn');

  if (anchor && anchor.parentNode === kicker) {
    anchor.after(bookBtn, helpBtn);
  } else {
    kicker.append(bookBtn, helpBtn);
  }
}

function createBookModal() {
  if (document.getElementById('bookOv')) return;
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.id = 'bookOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Project Book & Documentation Reader');
  ov.innerHTML = `
    <div class="modal hb-modal">
      <div class="mh">
        <div style="min-width:0">
          <div class="c-top"><span class="hb-badge">PROJECT HANDBOOK</span><span class="mono" style="font-size:11px;color:var(--ink2)" id="hbBookMeta">Documentation &amp; Architecture</span></div>
          <h3>📖 Project Book &amp; Documentation Reader</h3>
        </div>
        <button type="button" class="btn x" data-close>ESC ✕</button>
      </div>
      <div class="hb-book-body">
        <aside class="hb-side">
          <div class="hb-search-wrap">
            <input type="search" class="hb-search" id="hbSearch" placeholder="Filter chapters (title or path)…" aria-label="Filter chapters">
          </div>
          <div class="hb-chapters" id="hbChapters"></div>
        </aside>
        <div class="hb-main">
          <div class="hb-bar">
            <span class="hb-bar-title" id="hbCurTitle">Select a chapter</span>
            <span class="hb-pill" id="hbCurPath">—</span>
            <span class="hb-pill" id="hbCurTime">~0 min read</span>
            <div class="hb-nav">
              <button type="button" class="btn" id="hbPrevBtn">← Prev</button>
              <button type="button" class="btn" id="hbNextBtn">Next →</button>
            </div>
          </div>
          <div class="hb-read hb-md" id="hbReadPane">
            <div class="empty"><b>Loading handbook…</b>Fetching documentation index from /api/docs</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-close]')) {
      closeBook();
    }
  });

  ov.querySelector('#hbSearch').addEventListener('input', e => {
    searchQuery = e.target.value || '';
    renderChapterList();
  });

  ov.querySelector('#hbPrevBtn').addEventListener('click', () => stepChapter(-1));
  ov.querySelector('#hbNextBtn').addEventListener('click', () => stepChapter(1));

  ov.querySelector('#hbReadPane').addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy-code]');
    if (!btn) return;
    const wrap = btn.closest('.hb-code-wrap');
    const codeEl = wrap && wrap.querySelector('pre code');
    if (!codeEl) return;
    try {
      await navigator.clipboard.writeText(codeEl.textContent || '');
      const orig = btn.textContent;
      btn.textContent = 'COPIED ✓';
      setTimeout(() => { btn.textContent = orig; }, 1400);
    } catch {
      btn.textContent = 'FAILED';
      setTimeout(() => { btn.textContent = 'COPY'; }, 1400);
    }
  });
}

function helpTabContent(tab) {
  if (tab === 'guide') {
    return `
      <div class="hb-cards">
        <div class="hb-card">
          <h4>Collapsible Parallel Gantt (<code>#tl</code>)</h4>
          <p>Visualizes multi-agent concurrency lanes against wall-clock time and phase boundaries. Toggle collapse with the button or <code>G</code>, and switch zoom presets (<code>ALL</code>, <code>1H</code>, <code>15M</code>).</p>
        </div>
        <div class="hb-card">
          <h4>Agent Swarm &amp; Size Cards (<code>#swarm</code>)</h4>
          <p>Grouped by role or state. Each card shows model tier badge (<code>pro</code> / <code>flash</code> / <code>flash_lite</code> / <code>opus</code> / <code>sonnet</code> / <code>haiku</code> / <code>gpt_oss</code>), live progress bar, LOC touched, elapsed duration, and click-through event log.</p>
        </div>
        <div class="hb-card">
          <h4>Token &amp; Context Analytics (<code>#tokPanel</code>)</h4>
          <p>Tracks LLM token consumption across five views: <strong>By Model</strong>, <strong>By Task</strong>, <strong>By Phase</strong>, <strong>By Role</strong>, and cumulative <strong>Totals</strong> (input, cacheRead, output, contextUsed).</p>
        </div>
        <div class="hb-card">
          <h4>Generative Sound Studio</h4>
          <p>Pure Web Audio API sonification with <strong>22 scales</strong> (Western, East Asian, Middle Eastern incl. microtonal maqamat, Rich &amp; Exotic), <strong>6 episodes</strong> (incl. Magnetosphere VLF / Schumann 7.83 Hz &amp; Minimalist Glass), <strong>4-channel mixer</strong> (Melody, Bubbles, Magnetosphere, Drone), and user presets.</p>
        </div>
        <div class="hb-card">
          <h4>Progress Video Replay &amp; Scrubber</h4>
          <p>Plays back encoded <code>progress-replay.mp4</code> sessions at <code>0.5×–4×</code> speed and provides an interactive snapshot timelapse scrubber to time-travel across historical dashboard states.</p>
        </div>
        <div class="hb-card">
          <h4>Target Matrix &amp; Screenshots</h4>
          <p><strong>Target Matrix</strong> tracks build, unit test, and smoke/lint status across targets. <strong>Screenshots &amp; Visual QA</strong> displays Playwright captures &amp; previews with a full-screen lightbox.</p>
        </div>
      </div>
    `;
  }

  if (tab === 'shortcuts') {
    const bindings = [
      ['?', 'Toggle Help & Quick-Reference modal'],
      ['B', 'Toggle Project Book & Docs reader'],
      ['S', 'Open Generative Sound Studio'],
      ['V', 'Open Progress Video Replay'],
      ['G', 'Collapse / Expand Parallel Gantt'],
      ['1', 'Switch theme mode to Grid'],
      ['2', 'Switch theme mode to Dark'],
      ['3', 'Switch theme mode to Light'],
      ['Esc', 'Close active modal or lightbox'],
    ];
    return `
      <div class="hb-sec-title">Global Keyboard Shortcuts</div>
      <p style="margin:0 0 12px;color:var(--ink2);font:400 11.5px/1.5 var(--mono)">Shortcuts are active anywhere on the dashboard except when typing inside an input, textarea, or select control (or when Ctrl/Cmd/Alt is held).</p>
      <div class="hb-kbd-grid">
        ${bindings.map(([k, desc]) => `<div class="hb-kbd-row"><span>${escHtml(desc)}</span><kbd class="hb-kbd">${escHtml(k)}</kbd></div>`).join('')}
      </div>
    `;
  }

  return `
    <div class="hb-sec-title">track.mjs — Agent &amp; Telemetry Reporter</div>
    <pre class="hb-pre">gantt-track &lt;agentId&gt; &lt;start|progress|done|blocked|failed|note&gt; [pct] "&lt;msg&gt;"
gantt-track --check &lt;name&gt; &lt;pass|fail|running|skip&gt; "&lt;detail&gt;"
gantt-track --phase &lt;phaseId&gt; &lt;pending|active|done&gt;
gantt-track --tokens &lt;agentId&gt; &lt;input&gt; &lt;cacheRead&gt; &lt;output&gt; [contextUsed] [model]
gantt-track --init &lt;projectConfig&gt;</pre>

    <div class="hb-sec-title">recorder.mjs — Frame Capture &amp; MP4 Encoder</div>
    <pre class="hb-pre">gantt-record --url http://127.0.0.1:4780/?poll&amp;rec=1 --interval 4500
gantt-record --once   # Capture single frame &amp; encode progress-replay.mp4</pre>

    <div class="hb-sec-title">Environment Variables</div>
    <div class="hb-cards" style="margin-bottom:12px">
      <div class="hb-card"><h4>TRACKER_PORT</h4><p>HTTP bind port for <code>gantt-tracker</code> (default: <code>4780</code>).</p></div>
      <div class="hb-card"><h4>TRACKER_HOST</h4><p>Bind address for <code>gantt-tracker</code> (default: <code>127.0.0.1</code>).</p></div>
      <div class="hb-card"><h4>TRACKER_ROOT</h4><p>Repository root containing <code>.tracker/</code>, <code>out/</code>, and source dirs.</p></div>
    </div>

    <div class="hb-sec-title">.tracker/plan.json Structure</div>
    <pre class="hb-pre">{
  "project": "Project Name",
  "tagline": "Short mission subtitle",
  "startedAt": "ISO-8601 timestamp",
  "coordinator": { "id": "coordinator", "name": "...", "role": "coordinator", "model": "pro" },
  "phases": [{ "id": "p0", "name": "Phase Name", "status": "pending|active|done", "startedAt": "...", "endedAt": "..." }],
  "agents": [{ "id": "agent-id", "name": "Display Name", "role": "backend|ui|docs|qa|...", "model": "pro|flash|flash_lite", "phase": "p1" }]
}</pre>
  `;
}

function createHelpModal() {
  if (document.getElementById('helpOv')) return;
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.id = 'helpOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Tracker Help & Quick-Reference');
  ov.innerHTML = `
    <div class="modal hb-help-modal">
      <div class="mh">
        <div style="min-width:0">
          <div class="c-top"><span class="hb-badge">QUICK REFERENCE</span><span class="mono" style="font-size:11px;color:var(--ink2)">Dashboard · Shortcuts · CLI &amp; Protocol</span></div>
          <h3>❓ Tracker Help &amp; Interactive Guide</h3>
        </div>
        <button type="button" class="btn x" data-close>ESC ✕</button>
      </div>
      <div class="hb-tabs" id="hbHelpTabs">
        <button type="button" class="hb-tab on" data-htab="guide">Dashboard Guide</button>
        <button type="button" class="hb-tab" data-htab="shortcuts">Shortcuts</button>
        <button type="button" class="hb-tab" data-htab="cli">CLI &amp; Protocol</button>
      </div>
      <div class="hb-help-pane" id="hbHelpPane"></div>
    </div>
  `;
  document.body.appendChild(ov);

  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-close]')) {
      closeHelp();
    }
  });

  ov.querySelector('#hbHelpTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-htab]');
    if (!b) return;
    helpTab = b.getAttribute('data-htab');
    renderHelpTab();
  });

  renderHelpTab();
}

function renderHelpTab() {
  const ov = document.getElementById('helpOv');
  if (!ov) return;
  ov.querySelectorAll('[data-htab]').forEach(b => {
    b.classList.toggle('on', b.getAttribute('data-htab') === helpTab);
  });
  ov.querySelector('#hbHelpPane').innerHTML = helpTabContent(helpTab);
}

function filteredDocs() {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return docsIndex;
  return docsIndex.filter(d =>
    (d.title || '').toLowerCase().includes(q) ||
    (d.path || '').toLowerCase().includes(q)
  );
}

function renderChapterList() {
  const box = document.getElementById('hbChapters');
  if (!box) return;
  const list = filteredDocs();
  if (!list.length) {
    box.innerHTML = docsIndex.length
      ? '<div class="empty">No matching chapters</div>'
      : '<div class="empty"><b>No docs available</b>Add markdown docs or verify /api/docs.</div>';
    updateNavButtons();
    return;
  }

  // Group by category, keeping Overview then Docs first
  const groups = new Map();
  for (const doc of list) {
    const cat = doc.category || 'Docs';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(doc);
  }
  const orderedCats = [...groups.keys()].sort((a, b) => {
    const rank = c => (c === 'Overview' ? 0 : c === 'Docs' ? 1 : 2);
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  box.innerHTML = '';
  for (const cat of orderedCats) {
    const hd = document.createElement('div');
    hd.className = 'hb-cat';
    hd.textContent = cat;
    box.appendChild(hd);

    for (const doc of groups.get(cat)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hb-ch' + (doc.path === activePath ? ' on' : '');
      btn.dataset.docPath = doc.path;
      const t = document.createElement('span');
      t.className = 'hb-ch-t';
      t.textContent = doc.title || doc.path;
      const p = document.createElement('span');
      p.className = 'hb-ch-p';
      p.textContent = doc.path;
      btn.append(t, p);
      btn.addEventListener('click', () => loadChapter(doc.path));
      box.appendChild(btn);
    }
  }
  updateNavButtons();
}

function updateNavButtons() {
  const prevBtn = document.getElementById('hbPrevBtn');
  const nextBtn = document.getElementById('hbNextBtn');
  if (!prevBtn || !nextBtn) return;
  const idx = docsIndex.findIndex(d => d.path === activePath);
  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = idx < 0 || idx >= docsIndex.length - 1;
}

function stepChapter(delta) {
  if (!docsIndex.length) return;
  const idx = docsIndex.findIndex(d => d.path === activePath);
  const next = idx < 0 ? 0 : idx + delta;
  if (next >= 0 && next < docsIndex.length) {
    loadChapter(docsIndex[next].path);
  }
}

function estimateReadTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

async function loadChapter(path) {
  if (!path) return;
  activePath = path;
  renderChapterList();

  const titleEl = document.getElementById('hbCurTitle');
  const pathEl = document.getElementById('hbCurPath');
  const timeEl = document.getElementById('hbCurTime');
  const pane = document.getElementById('hbReadPane');
  if (!pane) return;

  const entry = docsIndex.find(d => d.path === path);
  if (titleEl) titleEl.textContent = entry?.title || path;
  if (pathEl) pathEl.textContent = path;
  if (timeEl) timeEl.textContent = 'Loading…';

  let doc = docCache.get(path);
  if (!doc) {
    pane.innerHTML = '<div class="empty">Loading chapter…</div>';
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(path)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      doc = await res.json();
      docCache.set(path, doc);
    } catch (err) {
      if (activePath !== path) return;
      if (timeEl) timeEl.textContent = 'Offline';
      pane.innerHTML = `<div class="empty"><b>Unable to load chapter</b>${escHtml(err?.message || 'Request failed')}</div>`;
      return;
    }
  }

  if (activePath !== path) return;
  const content = doc?.content ?? '';
  if (titleEl) titleEl.textContent = doc?.title || entry?.title || path;
  if (pathEl) pathEl.textContent = doc?.path || path;
  if (timeEl) timeEl.textContent = `~${estimateReadTime(content)} min read`;
  pane.innerHTML = content.trim()
    ? renderMarkdown(content)
    : '<div class="empty"><b>Empty document</b>This file has no content.</div>';
  pane.scrollTop = 0;
}

async function loadDocsIndex(force = false) {
  const pane = document.getElementById('hbReadPane');
  const meta = document.getElementById('hbBookMeta');
  if (!force && docsIndex.length) {
    if (!activePath && docsIndex[0]) await loadChapter(docsIndex[0].path);
    return;
  }

  try {
    const res = await fetch('/api/docs', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    docsIndex = Array.isArray(data?.docs) ? data.docs : [];
    if (meta) meta.textContent = `${docsIndex.length} chapter${docsIndex.length === 1 ? '' : 's'} indexed`;
    renderChapterList();
    if (!docsIndex.length) {
      if (pane) pane.innerHTML = '<div class="empty"><b>No documentation found</b><code>/api/docs</code> returned an empty chapter list.</div>';
      return;
    }
    const target = activePath && docsIndex.some(d => d.path === activePath)
      ? activePath
      : docsIndex[0].path;
    await loadChapter(target);
  } catch (err) {
    docsIndex = [];
    renderChapterList();
    if (meta) meta.textContent = 'Offline / Unavailable';
    if (pane) {
      pane.innerHTML = `<div class="empty"><b>Documentation API unavailable</b>Could not reach <code>/api/docs</code> (${escHtml(err?.message || 'offline')}).</div>`;
    }
  }
}

function openBook(path) {
  mount();
  closeHelp();
  const ov = document.getElementById('bookOv');
  if (!ov) return;
  ov.classList.add('on');
  if (path) {
    loadDocsIndex(false).then(() => loadChapter(path));
  } else {
    loadDocsIndex(!docsIndex.length);
  }
}

function closeBook() {
  document.getElementById('bookOv')?.classList.remove('on');
}

function openHelp(tab) {
  mount();
  closeBook();
  if (tab && ['guide', 'shortcuts', 'cli'].includes(tab)) {
    helpTab = tab;
    renderHelpTab();
  }
  document.getElementById('helpOv')?.classList.add('on');
}

function closeHelp() {
  document.getElementById('helpOv')?.classList.remove('on');
}

function closeAll() {
  closeBook();
  closeHelp();
}

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    closeAll();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isEditableTarget(e.target)) return;

  const k = e.key;
  if (k === '?') {
    e.preventDefault();
    const ov = document.getElementById('helpOv');
    if (ov?.classList.contains('on')) closeHelp();
    else openHelp();
  } else if (k === 'b' || k === 'B') {
    e.preventDefault();
    const ov = document.getElementById('bookOv');
    if (ov?.classList.contains('on')) closeBook();
    else openBook();
  } else if (k === 's' || k === 'S') {
    const btn = document.getElementById('openSoundStudioBtn') || document.getElementById('soundStudioBtn');
    if (btn) { e.preventDefault(); btn.click(); }
  } else if (k === 'v' || k === 'V') {
    const btn = document.getElementById('openReplayBtn');
    if (btn) { e.preventDefault(); btn.click(); }
  } else if (k === 'g' || k === 'G') {
    const btn = document.getElementById('tlToggle');
    if (btn) { e.preventDefault(); btn.click(); }
  } else if (k === '1' || k === '2' || k === '3') {
    const modeMap = { '1': 'grid', '2': 'dark', '3': 'light' };
    const btn = document.querySelector(`#modeTabs button[data-mode="${modeMap[k]}"]`);
    if (btn) { e.preventDefault(); btn.click(); }
  }
}

function mount() {
  if (mounted) return;
  mounted = true;
  injectStyles();
  createButtons();
  createBookModal();
  createHelpModal();
  window.addEventListener('keydown', handleKeydown);
}

if (typeof window !== 'undefined') {
  window.GanttHandbook = { openBook, openHelp, closeAll };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}
