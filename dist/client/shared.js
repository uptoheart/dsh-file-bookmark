// ── Shared types, helpers, API client, and design-system styles ──────────────
// This module is imported by all three feature modules (add / open / create).
// Feature modules MUST NOT import each other — they only depend on this file.
// ── Server discovery ──────────────────────────────────────────────────────────
const SERVER_BASE_PORT = 17319;
const SERVER_PORT_RANGE = 10;
let apiBase = '';
export async function discoverServer() {
    for (let port = SERVER_BASE_PORT; port < SERVER_BASE_PORT + SERVER_PORT_RANGE; port++) {
        try {
            const url = `http://127.0.0.1:${port}`;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 1500);
            const res = await fetch(`${url}/api/bookmarks`, { method: 'GET', signal: ctrl.signal });
            clearTimeout(timer);
            if (res.ok)
                return url;
        }
        catch { /* try next port */ }
    }
    return '';
}
async function ensureApiBase() {
    if (apiBase)
        return apiBase;
    apiBase = await discoverServer();
    return apiBase;
}
export async function apiGet(path) {
    const base = await ensureApiBase();
    if (!base)
        throw new Error('无法连接到宿主服务');
    const res = await fetch(`${base}${path}`);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
export async function apiPost(path, body) {
    const base = await ensureApiBase();
    if (!base)
        throw new Error('无法连接到宿主服务');
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
export async function apiDelete(path) {
    const base = await ensureApiBase();
    if (!base)
        throw new Error('无法连接到宿主服务');
    const res = await fetch(`${base}${path}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
// ── HTML escaping (prevent XSS) ──────────────────────────────────────────────
export function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => {
        switch (c) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return c;
        }
    });
}
// ── Toast ─────────────────────────────────────────────────────────────────────
export function toast(msg, ok = true) {
    const el = document.createElement('div');
    el.className = 'bkm-toast ' + (ok ? 'bkm-toast-ok' : 'bkm-toast-err');
    el.setAttribute('role', ok ? 'status' : 'alert');
    el.setAttribute('aria-live', 'polite');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}
// ── Shared bookmark state (single source of truth for both lists) ────────────
export let bookmarks = [];
const listeners = new Set();
export function subscribe(fn) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
function notify() {
    for (const fn of listeners)
        fn();
}
export async function refreshBookmarks() {
    try {
        bookmarks = await apiGet('/api/bookmarks');
    }
    catch {
        bookmarks = [];
    }
    notify();
}
export function renderBookmarkItem(b, showActions) {
    const name = b.path.split(/[/\\]/).pop() ?? b.path;
    const alias = b.alias ? escapeHtml(b.alias) : '<span class="bkm-no-alias">无别名</span>';
    return `<div class="bkm-item" data-action="open" data-alias="${escapeHtml(b.alias)}" title="点击打开: ${escapeHtml(b.path)}">
    <div class="bkm-item-info">
      <div class="bkm-item-name"><span class="bkm-badge bkm-badge-${b.type}">${b.type}</span> ${escapeHtml(name)}</div>
      <div class="bkm-item-alias">🏷 ${alias}</div>
      <div class="bkm-item-path">${escapeHtml(b.path)}</div>
    </div>
    ${showActions ? `<div class="bkm-item-acts">
      <button class="bkm-btn bkm-btn-s bkm-btn-primary" data-action="open" data-alias="${escapeHtml(b.alias)}">打开</button>
      <button class="bkm-btn bkm-btn-s bkm-btn-danger" data-action="remove" data-alias="${escapeHtml(b.alias)}" aria-label="删除书签">✕</button>
    </div>` : ''}
  </div>`;
}
// ── Design-system styles (injected once) ─────────────────────────────────────
export const STYLES = `
.bkm-panel {
  position: absolute;
  inset: 0;
  background: #14110f;
  color: #e8dcc8;
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  overflow-y: auto;
  padding: 24px;
  z-index: 1;
}
.bkm-panel::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(circle at 20% 0%, rgba(245,158,11,.06), transparent 40%), radial-gradient(circle at 80% 100%, rgba(132,204,22,.04), transparent 45%);
  z-index: 0;
}
.bkm-panel > * { position: relative; z-index: 1; }
.bkm-panel h1 {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0 0 20px;
  color: #f59e0b;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bkm-panel h1::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 22px;
  background: #f59e0b;
  border-radius: 2px;
}
.bkm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 14px;
}
.bkm-card {
  background: #1f1b17;
  border: 1px solid #3a332a;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25);
  transition: border-color .2s;
}
.bkm-card:hover { border-color: #524838; }
.bkm-card h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bkm-card .bkm-sub {
  font-size: .75rem;
  color: #8a7e6b;
  margin-bottom: 12px;
}
.bkm-fg { margin-bottom: 10px; }
.bkm-fg label {
  display: block;
  font-size: .75rem;
  color: #8a7e6b;
  margin-bottom: 4px;
  font-weight: 500;
}
.bkm-fg input, .bkm-fg select, .bkm-fg textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #3a332a;
  border-radius: 5px;
  background: #14110f;
  color: #e8dcc8;
  font-size: .82rem;
  font-family: inherit;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.bkm-fg input:focus, .bkm-fg select:focus, .bkm-fg textarea:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245,158,11,.2);
}
.bkm-fg textarea { resize: vertical; min-height: 50px; }
.bkm-row { display: flex; gap: 8px; }
.bkm-row > * { flex: 1; }
.bkm-btn {
  padding: 7px 14px;
  border: 1px solid #f59e0b;
  border-radius: 5px;
  background: transparent;
  color: #f59e0b;
  font-size: .8rem;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: background .15s, color .15s, transform .1s;
}
.bkm-btn:hover { background: #f59e0b; color: #14110f; }
.bkm-btn:active { transform: scale(.97); }
.bkm-btn:disabled { opacity: .5; cursor: not-allowed; }
.bkm-btn-primary { background: #f59e0b; color: #14110f; }
.bkm-btn-primary:hover { background: #fbbf24; border-color: #fbbf24; }
.bkm-btn-danger { border-color: #f87171; color: #f87171; }
.bkm-btn-danger:hover { background: #f87171; color: #14110f; }
.bkm-btn-s { padding: 4px 9px; font-size: .72rem; }
.bkm-list {
  flex: 1;
  max-height: 240px;
  overflow-y: auto;
  margin-top: 10px;
}
.bkm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  border: 1px solid #3a332a;
  border-radius: 6px;
  margin-bottom: 6px;
  background: #14110f;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.bkm-item:hover {
  border-color: #f59e0b;
  background: rgba(245,158,11,.06);
}
.bkm-item-info { flex: 1; min-width: 0; }
.bkm-item-name {
  font-size: .82rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}
.bkm-item-alias {
  font-size: .7rem;
  color: #f59e0b;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin-top: 2px;
}
.bkm-no-alias { color: #5c5346; }
.bkm-item-path {
  font-size: .66rem;
  color: #8a7e6b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin-top: 1px;
}
.bkm-item-acts { display: flex; gap: 4px; margin-left: 10px; flex-shrink: 0; }
.bkm-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: .6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .03em;
}
.bkm-badge-file { background: rgba(245,158,11,.15); color: #f59e0b; }
.bkm-badge-folder { background: rgba(132,204,22,.15); color: #84cc16; }
.bkm-empty {
  text-align: center;
  color: #8a7e6b;
  padding: 20px;
  font-size: .8rem;
  border: 1px dashed #3a332a;
  border-radius: 6px;
}
.bkm-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: .82rem;
  font-weight: 500;
  z-index: 9999;
  animation: bkmSlideIn .3s ease;
  box-shadow: 0 4px 16px rgba(0,0,0,.5);
  max-width: 320px;
}
.bkm-toast-ok { background: #1a2e0a; color: #84cc16; border: 1px solid #84cc16; }
.bkm-toast-err { background: #2e1414; color: #f87171; border: 1px solid #f87171; }
@keyframes bkmSlideIn {
  from { transform: translateX(120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.bkm-mt10 { margin-top: 10px; }
.bkm-path-row { display: flex; gap: 6px; align-items: stretch; }
.bkm-path-row input { flex: 1; }
.bkm-path-row .bkm-btn { white-space: nowrap; flex-shrink: 0; }
.bkm-hidden { display: none !important; }
.bkm-project-results {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 10px;
  font-size: .72rem;
  color: #8a7e6b;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.bkm-project-results .bkm-detail-line {
  padding: 3px 0;
  border-bottom: 1px solid #3a332a;
}
.bkm-project-results .bkm-detail-line:last-child { border-bottom: none; }
`;
