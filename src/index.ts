import type { Context } from '@deepseek-ai/cordis'
import { bookmarkAddTool } from './tools/add.js'
import { bookmarkOpenTool } from './tools/open.js'
import { projectCreateTool } from './tools/create.js'
import { startServer, setDshCtx } from './server.js'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const LOG_FILE = join(homedir(), '.dsh', 'dsh-file-bookmark.log')

function debugLog(...parts: unknown[]): void {
  const msg = parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ')
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { appendFileSync(LOG_FILE, line) } catch { console.log(msg) }
}

export const name = 'dsh-file-bookmark'
export const inject = ['tools', 'workspaceRegistry']

const TOOLS = [bookmarkAddTool, bookmarkOpenTool, projectCreateTool]

export async function apply(ctx: Context) {
  debugLog('=== Plugin starting ===')
  setDshCtx(ctx as unknown as Record<string, unknown>)

  for (const tool of TOOLS) {
    ctx.tools.register(tool)
  }

  const wr = (ctx as any).workspaceRegistry
  if (wr) {
    const proto = Object.getPrototypeOf(wr)
    const protoMethods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor')
    const ownKeys = Reflect.ownKeys(wr)
    debugLog('workspaceRegistry proto methods:', protoMethods)
    debugLog('workspaceRegistry own keys:', ownKeys)
    debugLog('workspaceRegistry full:', wr)
    try {
      const list = wr.list()
      debugLog(`current workspaces (${list.length}):`)
      list.forEach((w: any, i: number) => {
        debugLog(`  [${i}] id=${w.id} title=${w.title || '(no title)'} path=${w.path || '(no path)'}`)
      })
    } catch (e) {
      debugLog('WARN workspaceRegistry.list() failed:', e)
    }
  } else {
    debugLog('WARN workspaceRegistry not available on ctx')
  }

  const ctxKeys = Object.keys(ctx as any).filter(k => !k.startsWith('_')).sort()
  debugLog('all ctx keys:', ctxKeys)

  const events = (ctx as any).events
  if (events) {
    const evProto = Object.getPrototypeOf(events)
    const evMethods = Object.getOwnPropertyNames(evProto).filter(m => m !== 'constructor')
    debugLog('events methods:', evMethods)
  } else {
    debugLog('WARN ctx.events not available')
  }

  try {
    const { url } = await startServer()
    debugLog(`UI server started: ${url}`)
    debugLog(`Registered ${TOOLS.length} tools: ${TOOLS.map((t) => t.name).join(', ')}`)
  } catch (err) {
    debugLog('ERROR starting UI server:', err)
  }
}