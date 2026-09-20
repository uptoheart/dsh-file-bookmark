// dsh-file-bookmark client plugin — injects a sidebar entry and panel into the DSH Web GUI.
//
// Architecture:
//   - Sidebar: plain-DOM button injected after the "New Session" button, self-healing via MutationObserver.
//   - Panel:   plain-DOM container injected into the center column, toggled via data attribute on <html>.
//   - API:     communicates with the host plugin's HTTP API (same-origin via fetch).
//   - Features: split into ./client/add.ts, ./client/open.ts, ./client/create.ts (each owns one card).
//
import type { Context } from '@deepseek-ai/cordis'
import { STYLES, subscribe, refreshBookmarks, discoverServer } from './client/shared.js'
import { renderAddCard, wireAddEvents, renderAddList } from './client/add.js'
import { renderOpenCard, wireOpenEvents, renderOpenList } from './client/open.js'
import { renderCreateCard, wireCreateEvents } from './client/create.js'

export const inject: string[] = []

const PLUGIN_ID = 'dsh-file-bookmark'

// ── Sidebar entry injection core ─────────────────────────────────────────────
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (!column) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested) return nested
  for (const child of Array.from(root.children)) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

// ── Panel mount core ──────────────────────────────────────────────────────────
const CENTER_COL_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'

function centerColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CENTER_COL_SELECTOR) ?? undefined
}

// ── Panel UI assembly ─────────────────────────────────────────────────────────
function buildPanelHtml(): string {
  return `<div class="bkm-panel">
<h1>📁 文件收藏 &amp; 项目创建助手</h1>
<div class="bkm-grid">
${renderAddCard()}
${renderOpenCard()}
${renderCreateCard()}
</div></div>`
}

// ── Panel lifecycle ───────────────────────────────────────────────────────────
const PANEL_ACTIVE_ATTR = 'data-dsh-bookmark-active'

let panelContainer: HTMLDivElement | undefined
let panelOpen = false

function isPanelOpen(): boolean {
  return document.documentElement.hasAttribute(PANEL_ACTIVE_ATTR)
}

function closePanel(): void {
  document.documentElement.removeAttribute(PANEL_ACTIVE_ATTR)
  panelOpen = false
  document.documentElement.removeAttribute('data-dsh-ssh-active')
  document.documentElement.removeAttribute('data-dsh-taskboard-active')
  document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: '' }))
}

function openPanel(): void {
  ensurePanelMounted()
  document.documentElement.setAttribute(PANEL_ACTIVE_ATTR, '')
  panelOpen = true
  document.documentElement.removeAttribute('data-dsh-ssh-active')
  document.documentElement.removeAttribute('data-dsh-taskboard-active')
  document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'bookmark' }))
}

function ensurePanelMounted(): void {
  if (panelContainer?.isConnected) return
  const column = centerColumn()
  if (!column) return
  if (panelContainer) { panelContainer.remove(); panelContainer = undefined }
  panelContainer = document.createElement('div')
  panelContainer.dataset['dshBookmarkView'] = ''
  panelContainer.dataset['dshPlugin'] = PLUGIN_ID
  panelContainer.style.display = 'none'
  column.appendChild(panelContainer)
  panelContainer.innerHTML = buildPanelHtml()
  wirePanelEvents(panelContainer)
  // Subscribe list re-renders to bookmark state changes
  subscribe(renderAddList)
  subscribe(renderOpenList)
}

function wirePanelEvents(root: HTMLElement): void {
  wireAddEvents(root)
  wireOpenEvents(root)
  wireCreateEvents(root)
}

function syncPanelVisibility(): void {
  if (!panelContainer) return
  if (panelOpen) {
    panelContainer.style.display = ''
    const convColumn = centerColumn()
    if (convColumn) {
      for (const child of Array.from(convColumn.children)) {
        if (child !== panelContainer) {
          (child as HTMLElement).style.display = 'none'
        }
      }
    }
  } else {
    panelContainer.style.display = 'none'
    const convColumn = centerColumn()
    if (convColumn) {
      for (const child of Array.from(convColumn.children)) {
        if (child !== panelContainer) {
          (child as HTMLElement).style.display = ''
        }
      }
    }
  }
}

// ── Sidebar entry ─────────────────────────────────────────────────────────────
const ENTRY_ATTR = 'data-dsh-bookmark-entry'
const ENTRY_SELECTOR = `[${ENTRY_ATTR}]`

function injectSidebarEntry(): void {
  const root = sidebarRoot()
  if (!root) return
  if (root.querySelector(ENTRY_SELECTOR)) return
  const btn = newSessionButton(root)
  if (!btn) return

  const entry = document.createElement('button')
  entry.type = 'button'
  entry.setAttribute(ENTRY_ATTR, '')
  entry.setAttribute('data-dsh-plugin', PLUGIN_ID)
  entry.setAttribute('data-dsh-part', 'sidebar-entry')
  entry.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5v7l4 2V6.5l-4-2z"/><path d="M6 6.5l4-2v7l-4-2"/><path d="M14 3.5l-4 2v7l4-2v-7z"/></svg>'
  entry.title = '文件收藏助手'
  entry.setAttribute('aria-label', '文件收藏助手')

  const label = document.createElement('span')
  label.textContent = '文件收藏助手'
  label.style.cssText = 'font-size:12px;margin-left:6px;'

  entry.style.cssText = 'display:flex;align-items:center;width:100%;padding:6px 10px;border:none;background:transparent;color:inherit;cursor:pointer;font-size:13px;border-radius:6px;'
  entry.appendChild(label)

  entry.addEventListener('click', () => {
    if (isPanelOpen()) {
      closePanel()
      entry.classList.remove('active')
    } else {
      openPanel()
      refreshBookmarks()
      entry.classList.add('active')
    }
    syncPanelVisibility()
  })

  btn.insertAdjacentElement('afterend', entry)
}

// ── Self-healing observers ────────────────────────────────────────────────────
let sidebarObserver: MutationObserver | undefined
let panelColumnObserver: MutationObserver | undefined

function startSidebarObserver(): void {
  if (sidebarObserver) return
  sidebarObserver = new MutationObserver(() => {
    const root = sidebarRoot()
    if (root && !root.querySelector(ENTRY_SELECTOR)) {
      injectSidebarEntry()
    }
  })
  sidebarObserver.observe(document.body, { childList: true, subtree: true })
}

function startPanelColumnObserver(): void {
  if (panelColumnObserver) return
  panelColumnObserver = new MutationObserver(() => {
    if (panelOpen) {
      ensurePanelMounted()
      syncPanelVisibility()
    }
  })
  panelColumnObserver.observe(document.body, { childList: true, subtree: true })
}

// ── Close panel on sidebar workspace clicks ───────────────────────────────────
function handleSidebarClick(e: MouseEvent): void {
  if (!panelOpen) return
  const target = e.target as HTMLElement
  if (target.closest('[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]')) {
    closePanel()
    syncPanelVisibility()
  }
}

// ── Plugin apply ──────────────────────────────────────────────────────────────
declare global { var __dshFileBookmarkApplied: boolean | undefined }

export function apply(_ctx: Context): void {
  if (typeof document === 'undefined') return
  if (globalThis.__dshFileBookmarkApplied) return
  globalThis.__dshFileBookmarkApplied = true

  async function init(): Promise<void> {
    const base = await discoverServer()
    if (!base) {
      console.warn('[dsh-file-bookmark] 无法连接到宿主服务，面板 API 不可用')
    }

    const styleEl = document.createElement('style')
    styleEl.textContent = STYLES
    document.head.appendChild(styleEl)

    injectSidebarEntry()
    startSidebarObserver()
    startPanelColumnObserver()

    document.addEventListener('click', handleSidebarClick, true)

    document.addEventListener('dsh-panel-activate', ((e: CustomEvent) => {
      if (e.detail && e.detail !== 'bookmark' && panelOpen) {
        closePanel()
        syncPanelVisibility()
      }
    }) as EventListener)
  }

  init().catch((err) => console.error('[dsh-file-bookmark] 初始化失败:', err))
}