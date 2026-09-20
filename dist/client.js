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
.bkm-panel {
  position: absolute;
  inset: 0;
  background: #14110f;
  color: #e8dcc8;
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  overflow-y: auto;
  padding: 24px;
  z-index: 1;
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
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
  grid-auto-rows: 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
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
  min-height: 0;
}
.bkm-card:hover { border-color: #524838; }
.bkm-card h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 2px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.bkm-card .bkm-sub {
  font-size: .75rem;
  color: #8a7e6b;
  margin-bottom: 12px;
  flex-shrink: 0;
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
  overflow-y: auto;
  margin-top: 10px;
  min-height: 0;
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
.bkm-open-count { color: #f59e0b; font-weight: 600; font-size: .7rem; }
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
  flex: 1;
  overflow-y: auto;
  margin-top: 10px;
  font-size: .72rem;
  color: #8a7e6b;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  min-height: 0;
}
.bkm-project-results .bkm-detail-line {
  padding: 3px 0;
  border-bottom: 1px solid #3a332a;
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
function centerColumn() {
    return document.querySelector(CENTER_COL_SELECTOR) ?? undefined;
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
    document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: '' }));
}
function openPanel() {
    ensurePanelMounted();
    document.documentElement.setAttribute(PANEL_ACTIVE_ATTR, '');
    panelOpen = true;
    document.documentElement.removeAttribute('data-dsh-ssh-active');
    document.documentElement.removeAttribute('data-dsh-taskboard-active');
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
    if (panelOpen) {
        panelContainer.style.display = '';
        const convColumn = centerColumn();
        if (convColumn) {
            for (const child of Array.from(convColumn.children)) {
                if (child !== panelContainer) {
                    child.style.display = 'none';
                }
            }
        }
    }
    else {
        panelContainer.style.display = 'none';
        const convColumn = centerColumn();
        if (convColumn) {
            for (const child of Array.from(convColumn.children)) {
                if (child !== panelContainer) {
                    child.style.display = '';
                }
            }
        }
    }
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
