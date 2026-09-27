import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody, sendJson } from '../server-utils.js'
import { createProject, PROJECT_TYPES, detectWorkspaces, type CreateProjectOptions } from '../project-templates.js'
import { selectFolderDialog } from '../platform.js'

export async function handleCreateProject(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as CreateProjectOptions
  if (!body.projectName || !body.projectType) {
    sendJson(res, 400, { success: false, message: 'projectName and projectType are required' })
    return
  }
  if (!body.basePath && !body.workspacePath) {
    sendJson(res, 400, { success: false, message: 'basePath or workspacePath is required' })
    return
  }
  const result = await createProject(body)
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
  const basePath = url.searchParams.get('path')
  
  if (!basePath) {
    sendJson(res, 400, { success: false, message: 'path parameter is required' })
    return
  }
  
  const workspaces = detectWorkspaces(basePath)
  sendJson(res, 200, { 
    success: true, 
    workspaces: workspaces.map(ws => ({ path: ws.path, name: ws.name }))
  })
}