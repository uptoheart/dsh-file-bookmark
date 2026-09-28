import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody, sendJson } from '../server-utils.js'
import {
  createProject,
  PROJECT_TYPES,
  detectWorkspaces,
  listDshWorkspaces,
  registerDshWorkspace,
  type CreateProjectOptions,
  type WorkspaceInfo,
} from '../project-templates.js'
import { selectFolderDialog } from '../platform.js'
import { getDshCtx } from '../server.js'

function wsToDto(ws: WorkspaceInfo) {
  return {
    path: ws.path,
    name: ws.name,
    createdAt: ws.createdAt,
    items: ws.items.map(it => ({ name: it.name, path: it.path, isDirectory: it.isDirectory })),
  }
}

export async function handleCreateProject(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as CreateProjectOptions
  if (!body.basePath || !body.projectName || !body.projectType) {
    sendJson(res, 400, { success: false, message: 'basePath, projectName and projectType are required' })
    return
  }
  const result = await createProject(body)
  if (result.success) {
    try {
      registerDshWorkspace(result.projectPath, body.projectName)
      result.details?.push('鉁?宸叉敞鍐屽埌 DSH 渚ц竟鏍忓伐浣滃尯')
    } catch (err) {
      result.details?.push('鈿狅笍 DSH 渚ц竟鏍忔敞鍐屽け璐? ' + (err as Error).message)
    }
  }
  sendJson(res, 200, result)
}

export async function handleSelectFolder(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const result = await selectFolderDialog()
  sendJson(res, 200, result)
}

export async function handleProjectTypes(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, { success: true, types: PROJECT_TYPES })
}

export async function handleWorkspaces(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const basePath = url.searchParams.get('path')?.trim()

  const dshWorkspaces = listDshWorkspaces()

  if (!basePath) {
    sendJson(res, 200, { success: true, workspaces: dshWorkspaces.map(wsToDto) })
    return
  }

  const localWorkspaces = detectWorkspaces(basePath)

  const dshPaths = new Set(dshWorkspaces.map(w => w.path))
  const merged = [...dshWorkspaces]
  for (const ws of localWorkspaces) {
    if (!dshPaths.has(ws.path)) merged.push(ws)
  }

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  sendJson(res, 200, { success: true, workspaces: merged.map(wsToDto) })
}
