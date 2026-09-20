import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody, sendJson } from '../server-utils.js'
import { createProject, PROJECT_TYPES, type CreateProjectOptions } from '../project-templates.js'
import { selectFolderDialog } from '../platform.js'

export async function handleCreateProject(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as CreateProjectOptions
  if (!body.basePath || !body.projectName || !body.projectType) {
    sendJson(res, 400, { success: false, message: 'basePath, projectName and projectType are required' })
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