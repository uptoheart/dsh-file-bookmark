import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync } from 'node:fs'
import { readJsonBody, sendJson } from '../server-utils.js'
import { findBookmark, incrementOpenCount } from '../bookmarks.js'
import { openByMethod, type OpenMethod } from '../platform.js'

export async function handleOpenBookmark(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as { target?: string; path?: string; method?: OpenMethod }
  if (!body.target && !body.path) {
    sendJson(res, 400, { success: false, message: 'target or path is required' })
    return
  }

  const method = body.method ?? 'folder'

  let targetPath: string
  let alias: string | undefined

  if (body.path) {
    targetPath = body.path
  } else {
    const entry = findBookmark(body.target!)
    if (!entry) {
      if (body.target && existsSync(body.target)) {
        targetPath = body.target
      } else {
        sendJson(res, 404, { success: false, message: `未找到书签: "${body.target}"` })
        return
      }
    } else {
      targetPath = entry.path
      alias = entry.alias
    }
  }

  if (!existsSync(targetPath)) {
    sendJson(res, 404, { success: false, message: `路径不存在: ${targetPath}` })
    return
  }

  const result = await openByMethod(targetPath, method)

  if (result.success && alias) {
    incrementOpenCount(alias)
  }

  sendJson(res, 200, result)
}