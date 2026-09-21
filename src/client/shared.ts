// ── Shared types, helpers, API client, and design-system styles ──────────────
// This module is imported by all three feature modules (add / open / create).
// Feature modules MUST NOT import each other — they only depend on this file.

export interface BookmarkEntry {
  id: string
  alias: string
  path: string
  type: 'file' | 'folder'
  createdAt: string
  openCount: number
}

export interface CreateProjectResult {
  success: boolean
  projectPath: string
  message: string
  details: string[]
}

// ── Server discovery ──────────────────────────────────────────────────────────
const SERVER_BASE_PORT = 17319
const SERVER_PORT_RANGE = 10

let apiBase = ''

export async function discoverServer(): Promise<string> {
  for (let port = SERVER_BASE_PORT; port < SERVER_BASE_PORT + SERVER_PORT_RANGE; port++) {
    try {
      const url = `http://127.0.0.1:${port}`
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 1500)
      const res = await fetch(`${url}/api/bookmarks`, { method: 'GET', signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) return url
    } catch { /* try next port */ }
  }
  return ''
}

async function ensureApiBase(): Promise<string> {
  if (apiBase) return apiBase
  apiBase = await discoverServer()
  return apiBase
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = await ensureApiBase()
  if (!base) throw new Error('无法连接到宿主服务')
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = await ensureApiBase()
  if (!base) throw new Error('无法连接到宿主服务')
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as T
}

export async function apiDelete<T>(path: string): Promise<T> {
  const base = await ensureApiBase()
  if (!base) throw new Error('无法连接到宿主服务')
  const res = await fetch(`${base}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as T
}

// ── HTML escaping (prevent XSS) ──────────────────────────────────────────────
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return c
    }
  })
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function toast(msg: string, ok = true): void {
  const el = document.createElement('div')
  el.className = 'bkm-toast ' + (ok ? 'bkm-toast-ok' : 'bkm-toast-err')
  el.setAttribute('role', ok ? 'status' : 'alert')
  el.setAttribute('aria-live', 'polite')
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2800)
}

// ── Shared bookmark state (single source of truth for both lists) ────────────
export let bookmarks: BookmarkEntry[] = []

const listeners = new Set<() => void>()

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify(): void {
  for (const fn of listeners) fn()
}

export async function refreshBookmarks(): Promise<void> {
  try {
    bookmarks = await apiGet<BookmarkEntry[]>('/api/bookmarks')
  } catch {
    bookmarks = []
  }
  notify()
}

export function renderBookmarkItem(b: BookmarkEntry, showActions: boolean): string {
  const name = b.path.split(/[/\\]/).pop() ?? b.path
  const alias = b.alias ? escapeHtml(b.alias) : '<span class="bkm-no-alias">无别名</span>'
  const count = b.openCount ?? 0
  return `<div class="bkm-item" data-action="open" data-alias="${escapeHtml(b.alias)}" title="点击打开: ${escapeHtml(b.path)}">
    <div class="bkm-item-info">
      <div class="bkm-item-name"><span class="bkm-badge bkm-badge-${b.type}">${b.type}</span> ${escapeHtml(name)}</div>
      <div class="bkm-item-alias">🏷 ${alias}　<span class="bkm-open-count">🔥${count}</span></div>
      <div class="bkm-item-path">${escapeHtml(b.path)}</div>
    </div>
    ${showActions ? `<div class="bkm-item-acts">
      <button class="bkm-btn bkm-btn-s bkm-btn-primary" data-action="open" data-alias="${escapeHtml(b.alias)}">打开</button>
      <button class="bkm-btn bkm-btn-s bkm-btn-danger" data-action="remove" data-alias="${escapeHtml(b.alias)}" aria-label="删除书签">✕</button>
    </div>` : ''}
  </div>`
}

// ── Design-system styles (injected once) ─────────────────────────────────────
export const STYLES = `
/* ── DSH theme inheritance (falls back to sensible defaults) ─────────────── */
[data-dsh-bookmark-active] .bkm-panel,
.bkm-panel {
  --bkm-bg: var(--background, var(--vscode-editor-background, #ffffff));
  --bkm-text: var(--foreground, var(--vscode-editor-foreground, #24292e));
  --bkm-text-dim: var(--text-secondary, var(--vscode-descriptionForeground, #6e7781));
  --bkm-border: var(--border, var(--vscode-panel-border, #d0d7de));
  --bkm-border-h: var(--border-hover, var(--vscode-focusBorder, #0969da));
  --bkm-card: var(--card-bg, var(--vscode-sideBar-background, #f6f8fa));
  --bkm-input: var(--input-bg, var(--vscode-input-background, #ffffff));
  --bkm-accent: var(--accent, var(--vscode-textLink-foreground, #0969da));
  --bkm-accent-h: var(--accent-hover, var(--vscode-textLink-activeForeground, #0550ae));
  --bkm-accent-dim: var(--accent-dim, rgba(9,105,218,.08));
  --bkm-green: var(--success, var(--vscode-testing-iconPassed, #1a7f37));
  --bkm-red: var(--error, var(--vscode-testing-iconFailed, #cf222e));
  --bkm-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,.08));
  --bkm-radius: var(--radius, 8px);
  --bkm-gap: var(--gap, 12px);
}

/* ── Panel fills the center column (no absolute positioning) ─────────────── */
.bkm-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bkm-bg);
  color: var(--bkm-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  overflow-y: auto;
  padding: 20px;
}
.bkm-panel h1 {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--bkm-accent);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.bkm-panel h1::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 20px;
  background: var(--bkm-accent);
  border-radius: 2px;
}
.bkm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  grid-auto-rows: 1fr;
  gap: var(--bkm-gap);
  flex: 1;
  min-height: 0;
}
.bkm-card {
  background: var(--bkm-card);
  border: 1px solid var(--bkm-border);
  border-radius: var(--bkm-radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--bkm-shadow);
  transition: border-color .15s, box-shadow .15s;
  min-height: 0;
}
.bkm-card:hover {
  border-color: var(--bkm-border-h);
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.bkm-card h2 {
  font-size: .95rem;
  font-weight: 600;
  margin: 0 0 2px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.bkm-card .bkm-sub {
  font-size: .72rem;
  color: var(--bkm-text-dim);
  margin-bottom: 10px;
  flex-shrink: 0;
}
.bkm-fg { margin-bottom: 8px; }
.bkm-fg label {
  display: block;
  font-size: .72rem;
  color: var(--bkm-text-dim);
  margin-bottom: 3px;
  font-weight: 500;
}
.bkm-fg input, .bkm-fg select, .bkm-fg textarea {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--bkm-border);
  border-radius: 5px;
  background: var(--bkm-input);
  color: var(--bkm-text);
  font-size: .8rem;
  font-family: inherit;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.bkm-fg input:focus, .bkm-fg select:focus, .bkm-fg textarea:focus {
  border-color: var(--bkm-accent);
  box-shadow: 0 0 0 2px var(--bkm-accent-dim);
}
.bkm-fg textarea { resize: vertical; min-height: 48px; }
.bkm-row { display: flex; gap: 8px; }
.bkm-row > * { flex: 1; }
.bkm-btn {
  padding: 6px 12px;
  border: 1px solid var(--bkm-accent);
  border-radius: 5px;
  background: transparent;
  color: var(--bkm-accent);
  font-size: .78rem;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: background .15s, color .15s, transform .1s;
}
.bkm-btn:hover { background: var(--bkm-accent); color: var(--bkm-bg); }
.bkm-btn:active { transform: scale(.97); }
.bkm-btn:disabled { opacity: .5; cursor: not-allowed; }
.bkm-btn-primary { background: var(--bkm-accent); color: var(--bkm-bg); }
.bkm-btn-primary:hover { background: var(--bkm-accent-h); border-color: var(--bkm-accent-h); }
.bkm-btn-danger { border-color: var(--bkm-red); color: var(--bkm-red); }
.bkm-btn-danger:hover { background: var(--bkm-red); color: var(--bkm-bg); }
.bkm-btn-s { padding: 3px 8px; font-size: .7rem; }
.bkm-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
  min-height: 0;
}
.bkm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--bkm-border);
  border-radius: 6px;
  margin-bottom: 5px;
  background: var(--bkm-input);
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.bkm-item:hover {
  border-color: var(--bkm-accent);
  background: var(--bkm-accent-dim);
}
.bkm-item-info { flex: 1; min-width: 0; }
.bkm-item-name {
  font-size: .8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 5px;
}
.bkm-item-alias {
  font-size: .68rem;
  color: var(--bkm-accent);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin-top: 1px;
}
.bkm-no-alias { color: var(--bkm-text-dim); }
.bkm-item-path {
  font-size: .64rem;
  color: var(--bkm-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin-top: 1px;
}
.bkm-item-acts { display: flex; gap: 4px; margin-left: 8px; flex-shrink: 0; }
.bkm-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: .58rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .03em;
}
.bkm-badge-file { background: rgba(9,105,218,.1); color: var(--bkm-accent); }
.bkm-badge-folder { background: rgba(26,127,55,.1); color: var(--bkm-green); }
.bkm-empty {
  text-align: center;
  color: var(--bkm-text-dim);
  padding: 16px;
  font-size: .78rem;
  border: 1px dashed var(--bkm-border);
  border-radius: 6px;
}
.bkm-toast {
  position: fixed;
  bottom: 16px;
  right: 16px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: .8rem;
  font-weight: 500;
  z-index: 9999;
  animation: bkmSlideIn .25s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,.12);
  max-width: 300px;
}
.bkm-toast-ok { background: var(--bkm-bg); color: var(--bkm-green); border: 1px solid var(--bkm-green); }
.bkm-toast-err { background: var(--bkm-bg); color: var(--bkm-red); border: 1px solid var(--bkm-red); }
@keyframes bkmSlideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.bkm-mt10 { margin-top: 10px; }
.bkm-path-row { display: flex; gap: 6px; align-items: stretch; }
.bkm-path-row input { flex: 1; }
.bkm-path-row .bkm-btn { white-space: nowrap; flex-shrink: 0; }
.bkm-hidden { display: none !important; }
.bkm-project-results {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
  font-size: .7rem;
  color: var(--bkm-text-dim);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  min-height: 0;
}
.bkm-project-results .bkm-detail-line {
  padding: 3px 0;
  border-bottom: 1px solid var(--bkm-border);
}
.bkm-project-results .bkm-detail-line:last-child { border-bottom: none; }
`