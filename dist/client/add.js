// ── Feature: 添加收藏 (bookmark-add) ──────────────────────────────────────────
// Owns: the "添加收藏" card — form + bookmark list with open/remove actions.
import { bookmarks, refreshBookmarks, apiPost, apiDelete, toast, escapeHtml, renderBookmarkItem, } from './shared.js';
export function renderAddCard() {
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
export function wireAddEvents(root) {
    root.querySelector('#bkm-add-btn')?.addEventListener('click', handleAdd);
    const list = root.querySelector('#bkm-list-add');
    list?.addEventListener('click', addOnListClick);
}
export function renderAddList() {
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
