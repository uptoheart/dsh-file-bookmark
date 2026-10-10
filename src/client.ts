// dsh-file-bookmark client plugin — injects sidebar entry, panel is an iframe of the standalone UI.
//
// Architecture (matching dsh-taskboard):
//   - Official path (DSH 0.1.7+): slot-API panel registration via ctx.get('slots').
//     'sidebar.panellist' contributes the sidebar row; 'main' hosts the panel view.
//     The shell owns the button, active state, and panel switching — no DOM hacks.
//   - Legacy path: plain-DOM button + CSS-driven visibility, self-healing via MutationObserver.
//   - Panel: iframe pointing to the host plugin's HTTP server (server.ts serves ui.html at "/").
//     Single source of truth: src/ui.html + src/server.ts.
//
import type { Context } from '@deepseek-ai/cordis'
import { STYLES, discoverServer } from './client/shared.js'

export const inject: string[] = []

const PLUGIN_ID = 'dsh-file-bookmark'
const PANEL_NAME = 'bookmark'
const DEBUG = true

function dbg(...parts: unknown[]): void {
  if (!DEBUG) return
  console.log('[dsh-file-bookmark]', ...parts)
}

// ── Slots service face (matching dsh-taskboard official-panel.tsx) ────────────
interface SlotsServiceFace {
  inject(key: string, callback: () => unknown): () => void
  register(options: Record<string, unknown>, component: (props: never) => unknown): () => void
  spec(key: string): unknown
}

interface LayoutServiceFace {
  selectPanel(panelId: null): void
}

interface MountContextFace {
  get?(name: string): unknown
}

function officialSlots(ctx: MountContextFace): SlotsServiceFace | undefined {
  const slots = (ctx.get?.('slots') ?? (ctx as unknown as Record<string, unknown>).slots) as SlotsServiceFace | undefined
  if (slots === undefined || typeof slots.register !== 'function' || typeof slots.inject !== 'function' || typeof slots.spec !== 'function') return undefined
  try {
    if (slots.spec('main') === undefined) return undefined
    if (slots.spec('sidebar.panellist') === undefined) return undefined
  } catch {
    return undefined
  }
  return slots
}

// ── Sidebar entry injection core ─────────────────────────────────────────────
function findSidebarColumn(): HTMLElement | undefined {
  const selectors = [
    '[data-pane="sidebar"]',
    '[class*="sidebarCol"]',
    '[class*="SidebarCol"]',
    '[class*="sidebar-col"]',
    '[class*="sidebar_column"]',
    '[class*="sideBar"]',
    '[class*="SideBar"]',
    '[class*="leftCol"]',
    '[class*="LeftCol"]',
    '[class*="navCol"]',
    '[class*="NavCol"]',
    '[class*="panelLeft"]',
    '[class*="leftPanel"]',
  ]
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) {
      dbg('sidebar column found via selector:', sel)
      return el
    }
  }

  const body = document.body
  const appRoot = body.querySelector('#root') ?? body.querySelector('#app') ?? body.firstElementChild
  if (appRoot) {
    const firstCol = appRoot.querySelector(':scope > div > div:first-child') as HTMLElement | null
    if (firstCol) {
      const hasButtons = firstCol.querySelectorAll('button').length
      const hasListItems = firstCol.querySelectorAll('[class*="session"], [class*="Session"], [class*="project"], [class*="Project"]').length
      if (hasButtons > 0 || hasListItems > 0) {
        dbg('sidebar column found via layout heuristic (first child of app root)')
        return firstCol
      }
    }
  }

  dbg('sidebar column NOT found')
  return undefined
}

function sidebarRoot(): HTMLElement | undefined {
  const column = findSidebarColumn()
  if (!column) return undefined

  const logoRowSelectors = [
    '[class*="logoRow"]',
    '[class*="LogoRow"]',
    '[class*="logo-row"]',
    '[class*="headerRow"]',
    '[class*="HeaderRow"]',
    '[class*="topRow"]',
    '[class*="TopRow"]',
    '[class*="actionBar"]',
    '[class*="ActionBar"]',
  ]
  for (const sel of logoRowSelectors) {
    const logoEl = column.querySelector<HTMLElement>(sel)
    if (logoEl?.parentElement) {
      dbg('sidebar root found via logoRow selector:', sel)
      return logoEl.parentElement
    }
  }

  const firstChild = column.firstElementChild as HTMLElement | undefined
  if (firstChild) {
    dbg('sidebar root fallback: column.firstElementChild')
  }
  return firstChild
}

function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const classSelectors = [
    'button[class*="newSession"]',
    'button[class*="NewSession"]',
    'button[class*="new-session"]',
    'button[class*="newChat"]',
    'button[class*="NewChat"]',
    'button[class*="new-chat"]',
    'button[class*="addSession"]',
    'button[class*="AddSession"]',
    'button[class*="createSession"]',
  ]
  for (const sel of classSelectors) {
    const btn = root.querySelector<HTMLButtonElement>(sel)
    if (btn) {
      dbg('newSession button found via selector:', sel)
      return btn
    }
  }

  const textPatterns = ['新会话', '新建会话', '新对话', 'new session', 'new chat', 'new conversation']
  const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
  for (const btn of allButtons) {
    const text = (btn.textContent || '').trim().toLowerCase()
    const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase()
    const title = (btn.getAttribute('title') || '').trim().toLowerCase()
    for (const pattern of textPatterns) {
      const lp = pattern.toLowerCase()
      if (text.includes(lp) || ariaLabel.includes(lp) || title.includes(lp)) {
        dbg('newSession button found via text match:', pattern)
        return btn
      }
    }
  }

  for (const child of Array.from(root.children)) {
    if (child.tagName === 'BUTTON') {
      dbg('newSession button fallback: first BUTTON child')
      return child as HTMLButtonElement
    }
  }

  const anyButton = root.querySelector<HTMLButtonElement>('button')
  if (anyButton) {
    dbg('newSession button fallback: any button in root')
    return anyButton
  }

  dbg('newSession button NOT found in root, children:', root.children.length, Array.from(root.children).map(c => c.tagName + '.' + (c as HTMLElement).className?.slice(0, 30)))
  return undefined
}

// ── Panel mount core ──────────────────────────────────────────────────────────

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"], .dshDesktopConversationSurface'

function centerColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR) ?? undefined
}

// ── Panel lifecycle ───────────────────────────────────────────────────────────
const ACTIVE_ATTR = 'data-dsh-bookmark-active'
const OTHER_ACTIVE_ATTRS = ['data-dsh-ssh-active', 'data-dsh-taskboard-active']
const ACTIVATE_EVENT = 'dsh-panel-activate'

let panelContainer: HTMLDivElement | undefined
let panelIframe: HTMLIFrameElement | undefined
let panelOpen = false
let serverBaseUrl = ''

function isPanelOpen(): boolean {
  return document.documentElement.hasAttribute(ACTIVE_ATTR)
}

function closePanel(): void {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  panelOpen = false
  for (const attr of OTHER_ACTIVE_ATTRS) document.documentElement.removeAttribute(attr)
  document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: '' }))
}

function openPanel(): void {
  ensurePanelMounted()
  for (const attr of OTHER_ACTIVE_ATTRS) document.documentElement.removeAttribute(attr)
  document.documentElement.setAttribute(ACTIVE_ATTR, '')
  panelOpen = true
  document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
}

function ensurePanelMounted(): void {
  if (panelContainer?.isConnected) return
  const column = centerColumn()
  if (!column) {
    dbg('ensurePanelMounted: center column not found yet')
    return
  }
  if (panelContainer) { panelContainer.remove(); panelContainer = undefined; panelIframe = undefined }

  panelContainer = document.createElement('div')
  panelContainer.dataset.dshBookmarkView = ''
  panelContainer.dataset.dshPlugin = PLUGIN_ID
  panelContainer.className = 'dsh-bkm-view'

  panelIframe = document.createElement('iframe')
  panelIframe.style.cssText = 'width:100%;height:100%;border:0;display:block;'
  panelIframe.title = '文件收藏助手'
  if (serverBaseUrl) panelIframe.src = serverBaseUrl

  panelContainer.appendChild(panelIframe)
  column.appendChild(panelContainer)
  dbg('panel container mounted in center column')
}

// ── Sidebar entry ─────────────────────────────────────────────────────────────
const ENTRY_ATTR = 'data-dsh-bookmark-entry'
const ENTRY_SELECTOR = `[${ENTRY_ATTR}]`

function createSidebarEntry(): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.setAttribute(ENTRY_ATTR, '')
  entry.className = 'dsh-bkm-entry'
  entry.setAttribute('data-dsh-plugin', PLUGIN_ID)
  entry.setAttribute('data-dsh-part', 'sidebar-entry')
  entry.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5v7l4 2V6.5l-4-2z"/><path d="M6 6.5l4-2v7l-4-2"/><path d="M14 3.5l-4 2v7l4-2v-7z"/></svg><span class="bkm-sidebar-label">文件收藏助手</span>'
  entry.title = '文件收藏助手'
  entry.setAttribute('aria-label', '文件收藏助手')

  entry.addEventListener('click', () => {
    if (isPanelOpen()) {
      closePanel()
      delete entry.dataset.active
    } else {
      openPanel()
      if (panelIframe && serverBaseUrl && panelIframe.src !== serverBaseUrl) {
        panelIframe.src = serverBaseUrl
      }
      entry.dataset.active = 'true'
    }
  })

  return entry
}

function injectSidebarEntry(): void {
  const column = findSidebarColumn()
  if (!column) {
    dbg('injectSidebarEntry: sidebar column not found, skipping')
    return
  }

  if (column.querySelector(ENTRY_SELECTOR)) {
    dbg('injectSidebarEntry: entry already exists')
    return
  }

  const root = sidebarRoot()
  const entry = createSidebarEntry()

  if (root) {
    const btn = newSessionButton(root)
    if (btn) {
      const family = Array.from(root.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-bookmark-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
      )
      const anchor = family.length > 0 ? (family[0] ?? null) : (btn.nextElementSibling ?? null)
      if (anchor) root.insertBefore(entry, anchor)
      else root.appendChild(entry)
      dbg('injectSidebarEntry: entry inserted in family block')
      return
    }

    root.insertAdjacentElement('afterbegin', entry)
    dbg('injectSidebarEntry: entry prepended to sidebar root (no newSession button)')
    return
  }

  column.insertAdjacentElement('afterbegin', entry)
  dbg('injectSidebarEntry: entry prepended to sidebar column (no root)')
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

// ── Legacy mount (matching dsh-taskboard board-mount.tsx) ─────────────────────

function mountLegacy(): () => void {
  const entry = createSidebarEntry()
  let placed = false
  let root: HTMLElement | undefined

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      root = undefined
      placed = false
    }
    if (placed && document.body.contains(entry)) return
    root ??= sidebarRoot()
    if (root === undefined) {
      const column = findSidebarColumn()
      if (column) {
        if (!column.querySelector(ENTRY_SELECTOR)) {
          column.insertAdjacentElement('afterbegin', entry)
          placed = true
        }
      }
      return
    }
    const btn = newSessionButton(root)
    if (btn === undefined) return
    if (entry.parentElement !== root) {
      const family = Array.from(root.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-bookmark-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
      )
      const anchor = family.length > 0 ? (family[0] ?? null) : (btn.nextElementSibling ?? null)
      if (anchor) root.insertBefore(entry, anchor)
      else root.appendChild(entry)
    }
    placed = true
  }

  const waitObserver = new MutationObserver(() => { tryPlace() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) {
      placed = placeEntry(root, entry)
    }
  })

  const retry = setInterval(() => { tryPlace() }, 2_000)

  const syncActive = (): void => {
    if (panelOpen) entry.dataset.active = 'true'
    else delete entry.dataset.active
  }

  const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"], [data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-plugin]'
  const onClickSidebarRow = (event: MouseEvent): void => {
    if (!panelOpen) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (target.closest(ENTRY_SELECTOR) !== null) return
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) {
      closePanel()
      syncActive()
      return
    }
    const sidebar = findSidebarColumn()
    if (sidebar && sidebar.contains(target)) {
      closePanel()
      syncActive()
    }
  }
  const onOtherActivate = (event: Event): void => {
    const detail = (event as CustomEvent).detail
    if (detail !== PANEL_NAME && detail !== '' && panelOpen) {
      closePanel()
      syncActive()
    }
  }

  document.addEventListener('click', onClickSidebarRow, true)
  document.addEventListener(ACTIVATE_EVENT, onOtherActivate)

  const htmlAttrObserver = new MutationObserver((mutations) => {
    if (!panelOpen) return
    for (const m of mutations) {
      if (m.type !== 'attributes') continue
      if (m.attributeName === ACTIVE_ATTR) continue
      if (m.attributeName?.startsWith('data-dsh-') && m.attributeName.endsWith('-active')) {
        if (document.documentElement.hasAttribute(m.attributeName)) {
          dbg('other plugin activated via attr:', m.attributeName, '— closing our panel')
          closePanel()
          syncActive()
        }
      }
    }
  })
  htmlAttrObserver.observe(document.documentElement, { attributes: true })

  const panelObserver = new MutationObserver(() => {
    if (panelOpen) ensurePanelMounted()
  })
  panelObserver.observe(document.body, { childList: true, subtree: true })

  tryPlace()
  syncActive()

  return () => {
    clearInterval(retry)
    waitObserver.disconnect()
    rootObserver.disconnect()
    panelObserver.disconnect()
    htmlAttrObserver.disconnect()
    document.removeEventListener('click', onClickSidebarRow, true)
    document.removeEventListener(ACTIVATE_EVENT, onOtherActivate)
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    entry.remove()
  }
}

function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-bookmark-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
    )
    const anchor = family.length > 0 ? (family[0] ?? null) : (button.nextElementSibling ?? null)
    if (anchor) root.insertBefore(entry, anchor)
    else root.appendChild(entry)
  }
  return true
}

// ── Official slot-API panel (matching dsh-taskboard official-panel.tsx) ────────

const OFFICIAL_PANEL_ID = 'dsh-file-bookmark'
const PANEL_ROW_ORDER = 20

type ReactNode = unknown
type ReactFC = (props: never) => ReactNode

interface ReactLike {
  createElement(type: string | unknown, props: Record<string, unknown> | null, ...children: unknown[]): unknown
  useCallback<T>(callback: T, deps: unknown[]): T
}

function getReact(): ReactLike | undefined {
  const anyWin = window as unknown as Record<string, unknown>
  const R = (anyWin.React ?? anyWin.__REACT__) as Partial<ReactLike> | undefined
  if (R && typeof R.createElement === 'function' && typeof R.useCallback === 'function') return R as ReactLike
  return undefined
}

function makePanelPage(): ReactFC {
  return function BookmarkPanelPage(): ReactNode {
    const React = getReact()
    if (!React) return null
    const iframeRef = React.useCallback((el: HTMLIFrameElement | null) => {
      if (el && serverBaseUrl && el.src !== serverBaseUrl) el.src = serverBaseUrl
    }, [])
    return React.createElement(
      'div',
      { 'data-dsh-bookmark-view': '', 'data-dsh-plugin': PLUGIN_ID, className: 'dsh-bkm-view', style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } },
      React.createElement('iframe', { ref: iframeRef, style: { width: '100%', height: '100%', border: 0, display: 'block', flex: 1 }, title: '文件收藏助手' }),
    )
  }
}

function makePanelIcon(): ReactFC {
  return function BookmarkPanelIcon(): ReactNode {
    const React = getReact()
    if (!React) return null
    return React.createElement(
      'span',
      { className: 'dsh-bkm-pglyph' },
      React.createElement(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        React.createElement('path', { d: 'M2 4.5v7l4 2V6.5l-4-2z' }),
        React.createElement('path', { d: 'M6 6.5l4-2v7l-4-2' }),
        React.createElement('path', { d: 'M14 3.5l-4 2v7l4-2v-7z' }),
      ),
    )
  }
}

function tryRegisterOfficial(slots: SlotsServiceFace, ctx: MountContextFace): (() => void) | undefined {
  const React = getReact()
  if (!React) {
    dbg('tryRegisterOfficial: React not available, skipping official path')
    return undefined
  }
  const disposers: Array<() => void> = []
  try {
    const layout = (ctx.get?.('layout') ?? (ctx as unknown as Record<string, unknown>).layout) as LayoutServiceFace | undefined

    const page = makePanelPage() as unknown as ReactFC
    disposers.push(slots.inject('main', () => slots.register(
      { name: 'main', key: OFFICIAL_PANEL_ID },
      page,
    )))

    const icon = makePanelIcon() as unknown as ReactFC
    disposers.push(slots.inject('sidebar.panellist', () => slots.register(
      { name: 'sidebar.panellist', id: OFFICIAL_PANEL_ID, order: PANEL_ROW_ORDER, label: () => '文件收藏助手' },
      icon,
    )))
    console.info('[dsh-file-bookmark] official panel mode: registered', OFFICIAL_PANEL_ID)
  } catch (error) {
    console.error('[dsh-file-bookmark] official panel registration failed — falling back to legacy:', error)
    for (const dispose of disposers.splice(0)) dispose()
    return undefined
  }
  return () => { for (const dispose of disposers.splice(0)) dispose() }
}

const PROBE_ROUNDS = 3
const PROBE_INTERVAL_MS = 350

function mountPanelCompat(ctx: MountContextFace): () => void {
  const slots = officialSlots(ctx)
  if (slots !== undefined) {
    const dispose = tryRegisterOfficial(slots, ctx)
    if (dispose !== undefined) return dispose
  }

  let legacyDisposer: (() => void) | undefined = mountLegacy()

  let round = 0
  let upgraded: (() => void) | undefined
  const timer = setInterval(() => {
    round++
    const probed = officialSlots(ctx)
    if (probed !== undefined) {
      const dispose = tryRegisterOfficial(probed, ctx)
      if (dispose !== undefined) {
        upgraded = dispose
        legacyDisposer?.()
        legacyDisposer = undefined
        clearInterval(timer)
        console.info('[dsh-file-bookmark] upgraded to official panel mode')
        return
      }
    }
    if (round >= PROBE_ROUNDS) {
      clearInterval(timer)
    }
  }, PROBE_INTERVAL_MS)

  return () => {
    clearInterval(timer)
    legacyDisposer?.()
    upgraded?.()
  }
}

// ── Plugin apply ──────────────────────────────────────────────────────────────
declare global { var __dshFileBookmarkApplied: boolean | undefined }

export function apply(ctx: Context): void {
  if (typeof document === 'undefined') return
  if (globalThis.__dshFileBookmarkApplied) return
  globalThis.__dshFileBookmarkApplied = true

  const mountCtx = ctx as unknown as MountContextFace

  async function init(): Promise<void> {
    serverBaseUrl = await discoverServer()
    if (!serverBaseUrl) {
      console.warn('[dsh-file-bookmark] 无法连接到宿主服务，面板 iframe 不可用')
    }

    dbg('serverBaseUrl:', serverBaseUrl || '(empty)')

    const styleEl = document.createElement('style')
    styleEl.id = 'dsh-file-bookmark-styles'
    styleEl.textContent = STYLES
    document.head.appendChild(styleEl)

    const disposer = mountPanelCompat(mountCtx)

    const globalAttrObserver = new MutationObserver(() => {
      if (!panelOpen && document.documentElement.hasAttribute(ACTIVE_ATTR)) {
        document.documentElement.removeAttribute(ACTIVE_ATTR)
      }
    })
    globalAttrObserver.observe(document.documentElement, { attributes: true, attributeFilter: [ACTIVE_ATTR] })

    setupMessageListener()

    ;(ctx as unknown as { effect?: (fn: () => () => void, label?: string) => void }).effect?.(() => {
      const cleanup = () => { disposer(); globalAttrObserver.disconnect() }
      return cleanup
    }, 'dsh-file-bookmark: client mount')
  }

  init().catch((err) => console.error('[dsh-file-bookmark] 初始化失败:', err))
}