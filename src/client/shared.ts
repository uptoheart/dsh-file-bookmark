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

// ── Sidebar entry styles (matching dsh-taskboard .dsh-atb-entry pattern) ────
export const STYLES = `
/* ── Sidebar entry (left-aligned icon + label, same as taskboard) ─────── */
.dsh-bkm-entry, [data-dsh-bookmark-entry] {
  display: flex; align-items: center; justify-content: flex-start;
  gap: 8px; position: relative;
  width: 100%; margin: 2px 0; padding: 6px 10px;
  border: none; border-radius: 8px; background: transparent;
  color: var(--dsw-text-secondary, inherit); font: inherit; font-size: 13px;
  cursor: pointer; text-align: left;
  box-sizing: border-box; overflow: hidden;
  align-self: stretch;
  transition: background .12s, color .12s;
}
.dsh-bkm-entry:hover, [data-dsh-bookmark-entry]:hover {
  background: var(--dsw-hover, rgba(128,128,128,.12));
  color: var(--dsw-text-primary, inherit);
}
.dsh-bkm-entry[data-active="true"], [data-dsh-bookmark-entry][data-active="true"] {
  background: var(--dsw-active, rgba(128,128,128,.18));
  color: var(--dsw-text-primary, inherit); font-weight: 500;
}
.dsh-bkm-entry svg, [data-dsh-bookmark-entry] svg { flex: none; }
.dsh-bkm-entry .bkm-sidebar-label, [data-dsh-bookmark-entry] .bkm-sidebar-label {
  white-space: nowrap; max-width: 200px; overflow: hidden;
  font-size: 13px; font-weight: 400; line-height: 1;
}

/* ── Collapsed sidebar (icon-only) ────────────────────────────────────── */
[data-sidebar-collapsed] .dsh-bkm-entry,
[data-sidebar-collapsed] [data-dsh-bookmark-entry],
[class*="_collapsed"] .dsh-bkm-entry,
[class*="_collapsed"] [data-dsh-bookmark-entry] {
  width: 36px; height: 36px; min-width: 36px;
  margin: 0 0 12px; padding: 0;
  justify-content: center; gap: 0; text-align: center;
}
[data-sidebar-collapsed] .dsh-bkm-entry .bkm-sidebar-label,
[data-sidebar-collapsed] [data-dsh-bookmark-entry] .bkm-sidebar-label,
[class*="_collapsed"] .dsh-bkm-entry .bkm-sidebar-label,
[class*="_collapsed"] [data-dsh-bookmark-entry] .bkm-sidebar-label {
  display: none;
}
[data-sidebar-collapsed] .dsh-bkm-entry svg,
[data-sidebar-collapsed] [data-dsh-bookmark-entry] svg,
[class*="_collapsed"] .dsh-bkm-entry svg,
[class*="_collapsed"] [data-dsh-bookmark-entry] svg {
  width: 16px; height: 16px;
}

/* ── Panel visibility (CSS-driven, same as taskboard) ─────────────────── */
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

/* ── Panel icon glyph (official slot mode) ────────────────────────────── */
.dsh-bkm-pglyph { display: inline-flex; align-items: center; }
`