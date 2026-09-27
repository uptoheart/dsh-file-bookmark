// ── Client plugin shared: server discovery + sidebar entry styles ────────────
// The panel itself is now an iframe of the standalone UI (src/ui.html), so no
// rendering logic or API helpers live here anymore. Single source of truth: ui.html.

// ── Server discovery ──────────────────────────────────────────────────────────
const SERVER_BASE_PORT = 17319
const SERVER_PORT_RANGE = 10

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

// ── Sidebar entry styles (DSH theme tokens) ─────────────────────────────────
export const STYLES = `
/* ── Sidebar entry (match DSH newSession pattern) ──────────────────────── */
[data-dsh-bookmark-entry] {
  box-sizing: border-box;
  border: .5px solid var(--dsw-alias-border-l3);
  background: var(--dsw-alias-button-elevated-fill);
  height: 38px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  border-radius: 12px;
  flex: none;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin: 0 2px 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  display: flex;
  overflow: hidden;
  font-family: inherit;
  transition: background .15s;
}
[data-dsh-bookmark-entry]:hover {
  background: var(--dsw-alias-button-floating-hover);
}
.hHd-Xa_collapsed [data-dsh-bookmark-entry],
[data-sidebar-collapsed] [data-dsh-bookmark-entry] {
  background: transparent;
  border-color: transparent;
  align-self: flex-start;
  gap: 0;
  width: 36px;
  height: 36px;
  margin: 0 0 12px;
  padding: 0;
  justify-content: center;
}
.hHd-Xa_collapsed [data-dsh-bookmark-entry]:hover,
[data-sidebar-collapsed] [data-dsh-bookmark-entry]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
[data-dsh-bookmark-entry] svg {
  flex: none;
}
[data-dsh-bookmark-entry] .bkm-sidebar-label {
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.hHd-Xa_collapsed [data-dsh-bookmark-entry] .bkm-sidebar-label,
[data-sidebar-collapsed] [data-dsh-bookmark-entry] .bkm-sidebar-label {
  max-width: 0;
}
`