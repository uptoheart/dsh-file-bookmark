// ── Feature: 打开收藏 (bookmark-open) ────────────────────────────────────────
// Owns: the "打开收藏" card — clickable list that opens bookmarks in file manager.
import {
  bookmarks,
  refreshBookmarks,
  apiPost,
  apiDelete,
  toast,
  renderBookmarkItem,
} from './shared.js'

export function renderOpenCard(): string {
  return `<div class="bkm-card" id="bkm-card-open">
    <h2>🚀 打开收藏</h2>
    <p class="bkm-sub">点击任一收藏项，在文件管理器中打开</p>
    <div class="bkm-list" id="bkm-list-open"></div>
  </div>`
}

export function wireOpenEvents(root: HTMLElement): void {
  const list = root.querySelector('#bkm-list-open')
  list?.addEventListener('click', openOnListClick)
}

export function renderOpenList(): void {
  const container = document.getElementById('bkm-list-open')
  if (!container) return
  if (bookmarks.length === 0) {
    container.innerHTML = '<div class="bkm-empty">还没有收藏项，去"添加收藏"卡片添加</div>'
    return
  }
  container.innerHTML = bookmarks.map((b) => renderBookmarkItem(b, true)).join('')
}

function openOnListClick(e: Event): void {
  const target = e.target as HTMLElement
  const actionEl = target.closest('[data-action]') as HTMLElement | null
  if (!actionEl) return
  const action = actionEl.dataset.action
  const alias = actionEl.dataset.alias
  if (!alias) return
  e.stopPropagation()
  if (action === 'open') openOpenBookmark(alias)
  else if (action === 'remove') openRemoveBookmark(alias)
}

async function openOpenBookmark(alias: string): Promise<void> {
  try {
    const data = await apiPost<{ success: boolean; message: string }>('/api/open', { target: alias })
    toast(data.message, data.success)
  } catch (e) { toast('打开失败: ' + (e as Error).message, false) }
}

async function openRemoveBookmark(alias: string): Promise<void> {
  try {
    const data = await apiDelete<{ success: boolean; message: string }>(
      `/api/bookmarks/${encodeURIComponent(alias)}`,
    )
    toast(data.message, data.success)
    await refreshBookmarks()
  } catch (e) { toast('删除失败: ' + (e as Error).message, false) }
}