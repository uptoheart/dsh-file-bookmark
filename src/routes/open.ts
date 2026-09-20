import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody, sendJson } from '../server-utils.js'
import { findBookmark, incrementOpenCount } from '../bookmarks.js'
import { openInFileManager } from '../platform.js'

export async function handleOpenBookmark(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as { target?: string }
  if (!body.target) {
    sendJson(res, 400, { success: false, message: 'target is required' })
    return
  }
  const entry = findBookmark(body.target)
  if (!entry) {
    sendJson(res, 404, { success: false, message: `未找到书签: "${body.target}"` })
    return
  }
  const result = await openInFileManager(entry.path)

  if (result.success) {
    incrementOpenCount(body.target)
  }

  sendJson(res, 200, result)
}