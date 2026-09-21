window.__ModuleLoader__.load({
	id: "dsh-file-bookmark",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
// client\shared.js
// ── Shared types, helpers, API client, and design-system styles ──────────────
// This module is imported by all three feature modules (add / open / create).
// Feature modules MUST NOT import each other — they only depend on this file.
// ── Server discovery ──────────────────────────────────────────────────────────
const SERVER_BASE_PORT = 17319;
const SERVER_PORT_RANGE = 10;
let apiBase = '';
async function discoverServer() {
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
async function apiGet(path) {
    const base = await ensureApiBase();
    if (!base)
        throw new Error('无法连接到宿主服务');
    const res = await fetch(`${base}${path}`);
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function apiPost(path, body) {
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
async function apiDelete(path) {
    const base = await ensureApiBase();
    if (!base)
        throw new Error('无法连接到宿主服务');
    const res = await fetch(`${base}${path}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
// ── HTML escaping (prevent XSS) ──────────────────────────────────────────────
function escapeHtml(s) {
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
function toast(msg, ok = true) {
    const el = document.createElement('div');
    el.className = 'bkm-toast ' + (ok ? 'bkm-toast-ok' : 'bkm-toast-err');
    el.setAttribute('role', ok ? 'status' : 'alert');
    el.setAttribute('aria-live', 'polite');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
}
// ── Shared bookmark state (single source of truth for both lists) ────────────
let bookmarks = [];
const listeners = new Set();
function subscribe(fn) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
function notify() {
    for (const fn of listeners)
        fn();
}
async function refreshBookmarks() {
    try {
        bookmarks = await apiGet('/api/bookmarks');
    }
    catch {
        bookmarks = [];
    }
    notify();
}
function renderBookmarkItem(b, showActions) {
    const name = b.path.split(/[/\\]/).pop() ?? b.path;
    const alias = b.alias ? escapeHtml(b.alias) : '<span class="bkm-no-alias">无别名</span>';
    const count = b.openCount ?? 0;
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
  </div>`;
}
// ── Design-system styles (injected once) ─────────────────────────────────────
const STYLES = `
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
`;

// client\add.js
// ── Feature: 添加收藏 (bookmark-add) ──────────────────────────────────────────
// Owns: the "添加收藏" card — form + bookmark list with open/remove actions.

function renderAddCard() {
    return `<div class="bkm-card" id="bkm-card-add">
    <h2>🔖 添加收藏</h2>
    <p class="bkm-sub">收藏常用的文件或文件夹，通过别名快速访问</p>
    <div class="bkm-fg">
      <label for="bkm-add-path">文件 / 文件夹路径</label>
      <input type="text" id="bkm-add-path" placeholder="C:\\Users\\me\\project 或 /home/me/project">
    </div>
    <div class="bkm-row">
      <div class="bkm-fg">
        <label for="bkm-add-alias">别名（可选）</label>
        <input type="text" id="bkm-add-alias" placeholder="我的项目">
      </div>
      <div class="bkm-fg">
        <label for="bkm-add-type">类型</label>
        <select id="bkm-add-type">
          <option value="file">文件</option>
          <option value="folder">文件夹</option>
        </select>
      </div>
    </div>
    <button class="bkm-btn bkm-btn-primary" id="bkm-add-btn">➕ 添加收藏</button>
    <div class="bkm-list bkm-mt10" id="bkm-list-add"></div>
  </div>`;
}
function wireAddEvents(root) {
    root.querySelector('#bkm-add-btn')?.addEventListener('click', handleAdd);
    const list = root.querySelector('#bkm-list-add');
    list?.addEventListener('click', addOnListClick);
}
function renderAddList() {
    const container = document.getElementById('bkm-list-add');
    if (!container)
        return;
    if (bookmarks.length === 0) {
        container.innerHTML = '<div class="bkm-empty">还没有收藏项，在上方添加第一个</div>';
        return;
    }
    container.innerHTML = bookmarks.map((b) => renderBookmarkItem(b, true)).join('');
}
async function handleAdd() {
    const pathEl = document.getElementById('bkm-add-path');
    const aliasEl = document.getElementById('bkm-add-alias');
    const typeEl = document.getElementById('bkm-add-type');
    const btn = document.getElementById('bkm-add-btn');
    const path = pathEl?.value.trim() ?? '';
    if (!path) {
        toast('请输入路径', false);
        return;
    }
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 添加中...';
    }
    try {
        const data = await apiPost('/api/bookmarks', {
            path,
            alias: aliasEl?.value.trim() || undefined,
            type: typeEl?.value ?? 'file',
        });
        if (data.success) {
            toast(data.message);
            if (pathEl)
                pathEl.value = '';
            if (aliasEl)
                aliasEl.value = '';
        }
        else {
            toast(data.message, false);
        }
        await refreshBookmarks();
    }
    catch (e) {
        toast('请求失败: ' + e.message, false);
    }
    finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '➕ 添加收藏';
        }
    }
}
function addOnListClick(e) {
    const target = e.target;
    const actionEl = target.closest('[data-action]');
    if (!actionEl)
        return;
    const action = actionEl.dataset.action;
    const alias = actionEl.dataset.alias;
    if (!alias)
        return;
    e.stopPropagation();
    if (action === 'open')
        addOpenBookmark(alias);
    else if (action === 'remove')
        addRemoveBookmark(alias);
}
async function addOpenBookmark(alias) {
    try {
        const data = await apiPost('/api/open', { target: alias });
        toast(data.message, data.success);
    }
    catch (e) {
        toast('打开失败: ' + e.message, false);
    }
}
async function addRemoveBookmark(alias) {
    try {
        const data = await apiDelete(`/api/bookmarks/${encodeURIComponent(alias)}`);
        toast(data.message, data.success);
        await refreshBookmarks();
    }
    catch (e) {
        toast('删除失败: ' + e.message, false);
    }
}

// client\open.js
// ── Feature: 打开收藏 (bookmark-open) ────────────────────────────────────────
// Owns: the "打开收藏" card — clickable list that opens bookmarks in file manager.

function renderOpenCard() {
    return `<div class="bkm-card" id="bkm-card-open">
    <h2>🚀 打开收藏</h2>
    <p class="bkm-sub">点击任一收藏项，在文件管理器中打开</p>
    <div class="bkm-list" id="bkm-list-open"></div>
  </div>`;
}
function wireOpenEvents(root) {
    const list = root.querySelector('#bkm-list-open');
    list?.addEventListener('click', openOnListClick);
}
function renderOpenList() {
    const container = document.getElementById('bkm-list-open');
    if (!container)
        return;
    if (bookmarks.length === 0) {
        container.innerHTML = '<div class="bkm-empty">还没有收藏项，去"添加收藏"卡片添加</div>';
        return;
    }
    container.innerHTML = bookmarks.map((b) => renderBookmarkItem(b, true)).join('');
}
function openOnListClick(e) {
    const target = e.target;
    const actionEl = target.closest('[data-action]');
    if (!actionEl)
        return;
    const action = actionEl.dataset.action;
    const alias = actionEl.dataset.alias;
    if (!alias)
        return;
    e.stopPropagation();
    if (action === 'open')
        openOpenBookmark(alias);
    else if (action === 'remove')
        openRemoveBookmark(alias);
}
async function openOpenBookmark(alias) {
    try {
        const data = await apiPost('/api/open', { target: alias });
        toast(data.message, data.success);
    }
    catch (e) {
        toast('打开失败: ' + e.message, false);
    }
}
async function openRemoveBookmark(alias) {
    try {
        const data = await apiDelete(`/api/bookmarks/${encodeURIComponent(alias)}`);
        toast(data.message, data.success);
        await refreshBookmarks();
    }
    catch (e) {
        toast('删除失败: ' + e.message, false);
    }
}

// client\create.js
// ── Feature: 创建项目 (project-create) ───────────────────────────────────────
// Owns: the "创建项目" card — project type selector + creation form + results.

const PROJECT_TYPE_OPTIONS = [
    { group: '基础', items: [{ value: 'empty', label: '空白文件夹' }] },
    { group: '项目管理', items: [{ value: 'project-management', label: '项目管理工程' }] },
    { group: '代码类工程', items: [
            { value: 'code-java', label: 'Java 工程' },
            { value: 'code-python', label: 'Python 工程' },
            { value: 'code-vue', label: 'Vue 工程（npm 创建）' },
            { value: 'code-dsh-plugin', label: 'DSH Plugin 工程' },
        ] },
    { group: '知识类工程', items: [{ value: 'knowledge', label: '知识类工程' }] },
    { group: '探索类工程', items: [{ value: 'exploration', label: '探索类工程' }] },
    { group: '复制类工程', items: [{ value: 'copy', label: '复制类工程' }] },
];
function buildProjectTypeOptions() {
    return PROJECT_TYPE_OPTIONS.map((g) => {
        const opts = g.items.map((i) => `<option value="${i.value}">${i.label}</option>`).join('');
        return `<optgroup label="${g.group}">${opts}</optgroup>`;
    }).join('');
}
function renderCreateCard() {
    return `<div class="bkm-card" id="bkm-card-create">
    <h2>🚀 创建项目</h2>
    <p class="bkm-sub">选择项目类型，一键创建标准工程结构</p>
    <div class="bkm-fg">
      <label for="bkm-project-base">目标目录</label>
      <div class="bkm-path-row">
        <input type="text" id="bkm-project-base" placeholder="C:\\projects 或 /home/me/projects">
        <button class="bkm-btn bkm-btn-s" id="bkm-select-folder-btn" type="button">📂 选择文件夹</button>
      </div>
    </div>
    <div class="bkm-fg">
      <label for="bkm-project-name">项目名称</label>
      <input type="text" id="bkm-project-name" placeholder="my-project">
    </div>
    <div class="bkm-fg">
      <label for="bkm-project-type">项目类型</label>
      <select id="bkm-project-type">${buildProjectTypeOptions()}</select>
    </div>
    <div class="bkm-fg bkm-hidden" id="bkm-source-wrap">
      <label for="bkm-source-path">源工程路径</label>
      <div class="bkm-path-row">
        <input type="text" id="bkm-source-path" placeholder="C:\\projects\\source-project">
        <button class="bkm-btn bkm-btn-s" id="bkm-select-source-btn" type="button">📂 选择</button>
      </div>
    </div>
    <button class="bkm-btn bkm-btn-primary" id="bkm-create-project-btn" type="button">🚀 创建项目</button>
    <div class="bkm-list bkm-mt10" id="bkm-project-results"></div>
  </div>`;
}
function wireCreateEvents(root) {
    root.querySelector('#bkm-select-folder-btn')?.addEventListener('click', () => handleSelectFolder('bkm-project-base'));
    root.querySelector('#bkm-select-source-btn')?.addEventListener('click', () => handleSelectFolder('bkm-source-path'));
    root.querySelector('#bkm-project-type')?.addEventListener('change', handleProjectTypeChange);
    root.querySelector('#bkm-create-project-btn')?.addEventListener('click', handleCreateProject);
}
async function handleSelectFolder(targetInputId) {
    const inputEl = document.getElementById(targetInputId);
    try {
        const data = await apiGet('/api/select-folder');
        if (data.success && data.path) {
            if (inputEl)
                inputEl.value = data.path;
            toast(data.message);
        }
        else {
            toast(data.message, false);
        }
    }
    catch (e) {
        toast('选择文件夹失败: ' + e.message, false);
    }
}
function handleProjectTypeChange() {
    const typeEl = document.getElementById('bkm-project-type');
    const sourceWrap = document.getElementById('bkm-source-wrap');
    if (!typeEl || !sourceWrap)
        return;
    if (typeEl.value === 'copy')
        sourceWrap.classList.remove('bkm-hidden');
    else
        sourceWrap.classList.add('bkm-hidden');
}
async function handleCreateProject() {
    const baseEl = document.getElementById('bkm-project-base');
    const nameEl = document.getElementById('bkm-project-name');
    const typeEl = document.getElementById('bkm-project-type');
    const sourceEl = document.getElementById('bkm-source-path');
    const basePath = baseEl?.value.trim() ?? '';
    const projectName = nameEl?.value.trim() ?? '';
    const projectType = typeEl?.value ?? '';
    const sourcePath = sourceEl?.value.trim() ?? '';
    if (!basePath) {
        toast('请选择或输入目标目录', false);
        return;
    }
    if (!projectName) {
        toast('请输入项目名称', false);
        return;
    }
    if (projectType === 'copy' && !sourcePath) {
        toast('请输入源工程路径', false);
        return;
    }
    const btn = document.getElementById('bkm-create-project-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 创建中...';
    }
    try {
        const data = await apiPost('/api/create-project', {
            basePath,
            projectName,
            projectType,
            sourcePath: projectType === 'copy' ? sourcePath : undefined,
        });
        toast(data.message, data.success);
        renderProjectResults(data);
    }
    catch (e) {
        toast('创建项目失败: ' + e.message, false);
    }
    finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🚀 创建项目';
        }
    }
}
function renderProjectResults(result) {
    const container = document.getElementById('bkm-project-results');
    if (!container)
        return;
    if (!result.success) {
        container.innerHTML = `<div class="bkm-item">
      <div class="bkm-item-info">
        <div class="bkm-item-name">❌ 创建失败</div>
        <div class="bkm-item-path">${escapeHtml(result.message)}</div>
      </div>
    </div>`;
        return;
    }
    const detailsHtml = (result.details ?? []).map((d) => `<div class="bkm-detail-line">${escapeHtml(d)}</div>`).join('');
    const name = result.projectPath.split(/[/\\]/).pop() ?? result.projectPath;
    container.innerHTML = `<div class="bkm-item">
      <div class="bkm-item-info">
        <div class="bkm-item-name">✅ ${escapeHtml(name)}</div>
        <div class="bkm-item-path">${escapeHtml(result.projectPath)}</div>
      </div>
      <span class="bkm-badge bkm-badge-folder">project</span>
    </div>
    <div class="bkm-project-results">${detailsHtml}</div>`;
}

// client.js




const inject = [];
const PLUGIN_ID = 'dsh-file-bookmark';
// ── Sidebar entry injection core ─────────────────────────────────────────────
function sidebarRoot() {
    const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
    if (!column)
        return undefined;
    const logoOwner = column.querySelector('[class*="logoRow"]')?.parentElement;
    return logoOwner ?? column.firstElementChild;
}
function newSessionButton(root) {
    const nested = root.querySelector('button[class*="newSession"]');
    if (nested)
        return nested;
    for (const child of Array.from(root.children)) {
        if (child.tagName === 'BUTTON')
            return child;
    }
    return undefined;
}
// ── Panel mount core ──────────────────────────────────────────────────────────
const CENTER_COL_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]';
const CONVERSATION_CONTENT_SELECTOR = '[class*="conversation"], [class*="chatView"], [class*="messageList"], [data-pane="conversation"] > div:first-child';
function centerColumn() {
    return document.querySelector(CENTER_COL_SELECTOR) ?? undefined;
}
function conversationContent() {
    const col = centerColumn();
    if (!col)
        return undefined;
    const direct = col.querySelector(CONVERSATION_CONTENT_SELECTOR);
    if (direct && direct !== col)
        return direct;
    for (const child of Array.from(col.children)) {
        const el = child;
        if (el.dataset?.['dshBookmarkView'])
            continue;
        return el;
    }
    return col.firstElementChild;
}
let originalDisplay = '';
let originalPosition = '';
function hideConversation() {
    const content = conversationContent();
    if (!content)
        return;
    originalDisplay = content.style.display || 'block';
    originalPosition = content.style.position || '';
    content.style.display = 'none';
}
function showConversation() {
    const content = conversationContent();
    if (!content)
        return;
    content.style.display = originalDisplay || '';
    content.style.position = originalPosition || '';
}
// ── Panel UI assembly ─────────────────────────────────────────────────────────
function buildPanelHtml() {
    return `<div class="bkm-panel">
<h1>📁 文件收藏 &amp; 项目创建助手</h1>
<div class="bkm-grid">
${renderAddCard()}
${renderOpenCard()}
${renderCreateCard()}
</div></div>`;
}
// ── Panel lifecycle ───────────────────────────────────────────────────────────
const PANEL_ACTIVE_ATTR = 'data-dsh-bookmark-active';
let panelContainer;
let panelOpen = false;
function isPanelOpen() {
    return document.documentElement.hasAttribute(PANEL_ACTIVE_ATTR);
}
function closePanel() {
    document.documentElement.removeAttribute(PANEL_ACTIVE_ATTR);
    panelOpen = false;
    document.documentElement.removeAttribute('data-dsh-ssh-active');
    document.documentElement.removeAttribute('data-dsh-taskboard-active');
    showConversation();
    document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: '' }));
}
function openPanel() {
    ensurePanelMounted();
    document.documentElement.setAttribute(PANEL_ACTIVE_ATTR, '');
    panelOpen = true;
    document.documentElement.removeAttribute('data-dsh-ssh-active');
    document.documentElement.removeAttribute('data-dsh-taskboard-active');
    hideConversation();
    document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'bookmark' }));
}
function ensurePanelMounted() {
    if (panelContainer?.isConnected)
        return;
    const column = centerColumn();
    if (!column)
        return;
    if (panelContainer) {
        panelContainer.remove();
        panelContainer = undefined;
    }
    panelContainer = document.createElement('div');
    panelContainer.dataset['dshBookmarkView'] = '';
    panelContainer.dataset['dshPlugin'] = PLUGIN_ID;
    panelContainer.style.display = 'none';
    column.appendChild(panelContainer);
    panelContainer.innerHTML = buildPanelHtml();
    wirePanelEvents(panelContainer);
    // Subscribe list re-renders to bookmark state changes
    subscribe(renderAddList);
    subscribe(renderOpenList);
}
function wirePanelEvents(root) {
    wireAddEvents(root);
    wireOpenEvents(root);
    wireCreateEvents(root);
}
function syncPanelVisibility() {
    if (!panelContainer)
        return;
    panelContainer.style.display = panelOpen ? '' : 'none';
}
// ── Sidebar entry ─────────────────────────────────────────────────────────────
const ENTRY_ATTR = 'data-dsh-bookmark-entry';
const ENTRY_SELECTOR = `[${ENTRY_ATTR}]`;
function injectSidebarEntry() {
    const root = sidebarRoot();
    if (!root)
        return;
    if (root.querySelector(ENTRY_SELECTOR))
        return;
    const btn = newSessionButton(root);
    if (!btn)
        return;
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.setAttribute(ENTRY_ATTR, '');
    entry.setAttribute('data-dsh-plugin', PLUGIN_ID);
    entry.setAttribute('data-dsh-part', 'sidebar-entry');
    entry.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5v7l4 2V6.5l-4-2z"/><path d="M6 6.5l4-2v7l-4-2"/><path d="M14 3.5l-4 2v7l4-2v-7z"/></svg>';
    entry.title = '文件收藏助手';
    entry.setAttribute('aria-label', '文件收藏助手');
    const label = document.createElement('span');
    label.textContent = '文件收藏助手';
    label.style.cssText = 'font-size:12px;margin-left:6px;';
    entry.style.cssText = 'display:flex;align-items:center;width:100%;padding:6px 10px;border:none;background:transparent;color:inherit;cursor:pointer;font-size:13px;border-radius:6px;';
    entry.appendChild(label);
    entry.addEventListener('click', () => {
        if (isPanelOpen()) {
            closePanel();
            entry.classList.remove('active');
        }
        else {
            openPanel();
            refreshBookmarks();
            entry.classList.add('active');
        }
        syncPanelVisibility();
    });
    btn.insertAdjacentElement('afterend', entry);
}
// ── Self-healing observers ────────────────────────────────────────────────────
let sidebarObserver;
let panelColumnObserver;
function startSidebarObserver() {
    if (sidebarObserver)
        return;
    sidebarObserver = new MutationObserver(() => {
        const root = sidebarRoot();
        if (root && !root.querySelector(ENTRY_SELECTOR)) {
            injectSidebarEntry();
        }
    });
    sidebarObserver.observe(document.body, { childList: true, subtree: true });
}
function startPanelColumnObserver() {
    if (panelColumnObserver)
        return;
    panelColumnObserver = new MutationObserver(() => {
        if (panelOpen) {
            ensurePanelMounted();
            syncPanelVisibility();
        }
    });
    panelColumnObserver.observe(document.body, { childList: true, subtree: true });
}
// ── Close panel on sidebar workspace clicks ───────────────────────────────────
function handleSidebarClick(e) {
    if (!panelOpen)
        return;
    const target = e.target;
    if (target.closest('[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]')) {
        closePanel();
        syncPanelVisibility();
    }
}
function apply(_ctx) {
    if (typeof document === 'undefined')
        return;
    if (globalThis.__dshFileBookmarkApplied)
        return;
    globalThis.__dshFileBookmarkApplied = true;
    async function init() {
        const base = await discoverServer();
        if (!base) {
            console.warn('[dsh-file-bookmark] 无法连接到宿主服务，面板 API 不可用');
        }
        const styleEl = document.createElement('style');
        styleEl.textContent = STYLES;
        document.head.appendChild(styleEl);
        injectSidebarEntry();
        startSidebarObserver();
        startPanelColumnObserver();
        document.addEventListener('click', handleSidebarClick, true);
        document.addEventListener('dsh-panel-activate', ((e) => {
            if (e.detail && e.detail !== 'bookmark' && panelOpen) {
                closePanel();
                syncPanelVisibility();
            }
        }));
    }
    init().catch((err) => console.error('[dsh-file-bookmark] 初始化失败:', err));
}

	exports.escapeHtml = escapeHtml;
	exports.toast = toast;
	exports.bookmarks = bookmarks;
	exports.subscribe = subscribe;
	exports.renderBookmarkItem = renderBookmarkItem;
	exports.STYLES = STYLES;
	exports.renderAddCard = renderAddCard;
	exports.wireAddEvents = wireAddEvents;
	exports.renderAddList = renderAddList;
	exports.renderOpenCard = renderOpenCard;
	exports.wireOpenEvents = wireOpenEvents;
	exports.renderOpenList = renderOpenList;
	exports.renderCreateCard = renderCreateCard;
	exports.wireCreateEvents = wireCreateEvents;
	exports.inject = inject;
	exports.apply = apply;
		return module.exports;
	}
});
