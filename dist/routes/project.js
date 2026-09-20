import { readJsonBody, sendJson } from '../server-utils.js';
import { createProject, PROJECT_TYPES } from '../project-templates.js';
import { selectFolderDialog } from '../platform.js';
export async function handleCreateProject(req, res) {
    const body = await readJsonBody(req);
    if (!body.basePath || !body.projectName || !body.projectType) {
        sendJson(res, 400, { success: false, message: 'basePath, projectName and projectType are required' });
        return;
    }
    const result = await createProject(body);
    sendJson(res, 200, result);
}
export async function handleSelectFolder(_req, res) {
    const result = await selectFolderDialog();
    sendJson(res, 200, result);
}
export async function handleProjectTypes(_req, res) {
    sendJson(res, 200, { success: true, types: PROJECT_TYPES });
}
