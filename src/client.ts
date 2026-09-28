// dsh-file-bookmark client plugin — injects sidebar entry, panel is an iframe of the standalone UI.
//
// Architecture:
//   - Sidebar: plain-DOM button, self-healing via MutationObserver.
//   - Panel:   iframe pointing to the host plugin's HTTP server (server.ts serves ui.html at "/").
//              Single source of truth: src/ui.html + src/server.ts.
//
import type { Context } from '@deepseek-ai/cordis'
import { STYLES, discoverServer } from './client/shared.js'

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
const CONVERSATION_CONTENT_SELECTOR = '[class*="conversation"], [class*="chatView"], [class*="messageList"], [data-pane="conversation"] > div:first-child'

function centerColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CENTER_COL_SELECTOR) ?? undefined
}

function conversationContent(): HTMLElement | undefined {
  const col = centerColumn()
  if (!col) return undefined
  const direct = col.querySelector<HTMLElement>(CONVERSATION_CONTENT_SELECTOR)
  if (direct && direct !== col) return direct
  for (const child of Array.from(col.children)) {
    const el = child as HTMLElement
    if (el.dataset?.['dshBookmarkView']) continue
    return el
  }
  return col.firstElementChild as HTMLElement | undefined
}

let originalDisplay = ''
let originalPosition = ''

function hideConversation(): void {
  const content = conversationContent()
  if (!content) return
  originalDisplay = content.style.display || 'block'
  originalPosition = content.style.position || ''
  content.style.display = 'none'
}

function showConversation(): void {
  const content = conversationContent()
  if (!content) return
  content.style.display = originalDisplay || ''
  content.style.position = originalPosition || ''
}

// ── Panel lifecycle ───────────────────────────────────────────────────────────
const PANEL_ACTIVE_ATTR = 'data-dsh-bookmark-active'

let panelContainer: HTMLDivElement | undefined
let panelIframe: HTMLIFrameElement | undefined
let panelOpen = false
let serverBaseUrl = ''

function isPanelOpen(): boolean {
  return document.documentElement.hasAttribute(PANEL_ACTIVE_ATTR)
}

function closePanel(): void {
  document.documentElement.removeAttribute(PANEL_ACTIVE_ATTR)
  panelOpen = false
  document.documentElement.removeAttribute('data-dsh-ssh-active')
  document.documentElement.removeAttribute('data-dsh-taskboard-active')
  showConversation()
  document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: '' }))
}

function openPanel(): void {
  ensurePanelMounted()
  document.documentElement.setAttribute(PANEL_ACTIVE_ATTR, '')
  panelOpen = true
  document.documentElement.removeAttribute('data-dsh-ssh-active')
  document.documentElement.removeAttribute('data-dsh-taskboard-active')
  hideConversation()
  document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'bookmark' }))
}

function ensurePanelMounted(): void {
  if (panelContainer?.isConnected) return
  const column = centerColumn()
  if (!column) return
  if (panelContainer) { panelContainer.remove(); panelContainer = undefined; panelIframe = undefined }

  const prevPos = column.style.position
  if (prevPos !== 'absolute' && prevPos !== 'fixed') column.style.position = 'relative'

  panelContainer = document.createElement('div')
  panelContainer.dataset['dshBookmarkView'] = ''
  panelContainer.dataset['dshPlugin'] = PLUGIN_ID
  panelContainer.style.cssText = 'display:none;width:100%;height:100%;position:absolute;inset:0;z-index:1;'

  panelIframe = document.createElement('iframe')
  panelIframe.style.cssText = 'width:100%;height:100%;border:0;display:block;'
  panelIframe.title = '文件收藏助手'
  if (serverBaseUrl) panelIframe.src = serverBaseUrl

  panelContainer.appendChild(panelIframe)
  column.appendChild(panelContainer)
}

function syncPanelVisibility(): void {
  if (!panelContainer) return
  panelContainer.style.display = panelOpen ? '' : 'none'
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
  entry.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5v7l4 2V6.5l-4-2z"/><path d="M6 6.5l4-2v7l-4-2"/><path d="M14 3.5l-4 2v7l4-2v-7z"/></svg><span class="bkm-sidebar-label">文件收藏助手</span>'
  entry.title = '文件收藏助手'
  entry.setAttribute('aria-label', '文件收藏助手')

  entry.addEventListener('click', () => {
    if (isPanelOpen()) {
      closePanel()
      entry.classList.remove('active')
    } else {
      openPanel()
      if (panelIframe && serverBaseUrl && panelIframe.src !== serverBaseUrl) {
        panelIframe.src = serverBaseUrl
      }
      entry.classList.add('active')
    }
    syncPanelVisibility()
  })

  btn.insertAdjacentElement('afterend', entry)
}

// ── Auto-reload DSH after workspace creation ────────────────────────────────
function setupMessageListener(): void {
  window.addEventListener('message', (evt) => {
    const data = evt.data as { type?: string; path?: string; title?: string } | null
    if (!data || data.type !== 'dsh-file-bookmark:workspace-created') return
    if (!data.path || !data.title) return
    console.log('[dsh-file-bookmark] 工作区已创建，即将自动刷新 DSH:', data.title, data.path)
    setTimeout(() => {
      try { window.location.reload() } catch { /* ignore */ }
    }, 800)
  })
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
    serverBaseUrl = await discoverServer()
    if (!serverBaseUrl) {
      console.warn('[dsh-file-bookmark] 无法连接到宿主服务，面板 iframe 不可用')
    }

    const styleEl = document.createElement('style')
    styleEl.textContent = STYLES
    document.head.appendChild(styleEl)

    injectSidebarEntry()
    startSidebarObserver()
    startPanelColumnObserver()

    document.addEventListener('click', handleSidebarClick, true)
    setupMessageListener()

    document.addEventListener('dsh-panel-activate', ((e: CustomEvent) => {
      if (e.detail && e.detail !== 'bookmark' && panelOpen) {
        closePanel()
        syncPanelVisibility()
      }
    }) as EventListener)
  }

  init().catch((err) => console.error('[dsh-file-bookmark] 初始化失败:', err))
}