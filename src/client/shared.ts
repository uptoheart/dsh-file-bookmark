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

// ── Sidebar entry styles (exact copy of dsh-taskboard with !important) ────────
export const STYLES = `
/* ── Sidebar entry ─────────────────────────────────────────────────────── */
.dsh-bkm-entry, [data-dsh-bookmark-entry] {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  position: relative !important;
  text-align: left !important;
  width: calc(100% - 8px) !important;
  margin: 2px 4px !important;
  padding: 6px 10px !important;
  border: none !important;
  border-radius: 8px !important;
  background: transparent !important;
  color: var(--dsw-text-secondary, inherit) !important;
  font: inherit !important;
  font-size: 13px !important;
  cursor: pointer !important;
  box-shadow: none !important;
  outline: none !important;
  text-shadow: none !important;
  justify-items: inherit !important;
}
.dsh-bkm-entry:hover, [data-dsh-bookmark-entry]:hover {
  background: var(--dsw-hover, rgba(128,128,128,.12)) !important;
  color: var(--dsw-text-primary, inherit) !important;
}
.dsh-bkm-entry[data-active="true"], [data-dsh-bookmark-entry][data-active="true"] {
  background: var(--dsw-active, rgba(128,128,128,.18)) !important;
  color: var(--dsw-text-primary, inherit) !important;
  font-weight: 500 !important;
}
.dsh-bkm-entry svg, [data-dsh-bookmark-entry] svg {
  flex: none !important;
  display: block !important;
}
.dsh-bkm-entry .dsh-bkm-entry-icon, [data-dsh-bookmark-entry] .dsh-bkm-entry-icon {
  display: inline-flex !important;
  align-items: center !important;
  flex: none !important;
}
.dsh-bkm-entry .bkm-sidebar-label, [data-dsh-bookmark-entry] .bkm-sidebar-label {
  white-space: nowrap !important;
  max-width: 200px !important;
  overflow: hidden !important;
  text-align: left !important;
}

/* ── Collapsed sidebar ─────────────────────────────────────────────────── */
[data-sidebar-collapsed] .dsh-bkm-entry,
[data-sidebar-collapsed] [data-dsh-bookmark-entry],
[class*="_collapsed"] .dsh-bkm-entry,
[class*="_collapsed"] [data-dsh-bookmark-entry] {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  margin: 0 0 12px !important;
  padding: 0 !important;
  justify-content: center !important;
  gap: 0 !important;
  text-align: center !important;
}
[data-sidebar-collapsed] .dsh-bkm-entry .bkm-sidebar-label,
[data-sidebar-collapsed] [data-dsh-bookmark-entry] .bkm-sidebar-label,
[class*="_collapsed"] .dsh-bkm-entry .bkm-sidebar-label,
[class*="_collapsed"] [data-dsh-bookmark-entry] .bkm-sidebar-label { display: none !important; }
[data-sidebar-collapsed] .dsh-bkm-entry svg,
[data-sidebar-collapsed] [data-dsh-bookmark-entry] svg,
[class*="_collapsed"] .dsh-bkm-entry svg,
[class*="_collapsed"] [data-dsh-bookmark-entry] svg { width: 16px !important; height: 16px !important; }

/* ── Official panel icon (inside DSH's panelRow button) ──────────────── */
.dsh-bkm-pglyph { display: inline-flex !important; align-items: center !important; }
button[class*="panelRow"]:has(.dsh-bkm-pglyph) {
  position: relative !important;
  display: flex !important;
  justify-content: flex-start !important;
  align-items: center !important;
  text-align: left !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  font: inherit !important;
  color: var(--dsw-text-secondary, inherit) !important;
}
button[class*="panelRow"][data-active]:has(.dsh-bkm-pglyph),
button[class*="panelRow"]:has(.dsh-bkm-pglyph):hover {
  background: var(--dsw-hover, rgba(128,128,128,.12)) !important;
  color: var(--dsw-text-primary, inherit) !important;
}

/* ── Panel visibility (CSS-driven) ──────────────────────────────────────── */
html[data-dsh-bookmark-active] [data-pane="conversation"] > *:not([data-dsh-bookmark-view]),
html[data-dsh-bookmark-active] [class*="centerCol"] > *:not([data-dsh-bookmark-view]),
html[data-dsh-bookmark-active] .dshDesktopConversationSurface > *:not([data-dsh-bookmark-view]) {
  display: none !important;
}
.dsh-bkm-view, [data-dsh-bookmark-view] { display: none; }
html[data-dsh-bookmark-active] .dsh-bkm-view,
html[data-dsh-bookmark-active] [data-dsh-bookmark-view] {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
}
`