import { readJsonBody, sendJson } from '../server-utils.js';
import { findBookmark } from '../bookmarks.js';
import { openInFileManager } from '../platform.js';
export async function handleOpenBookmark(req, res) {
    const body = await readJsonBody(req);
    if (!body.target) {
        sendJson(res, 400, { success: false, message: 'target is required' });
        return;
    }
    const entry = findBookmark(body.target);
    if (!entry) {
        sendJson(res, 404, { success: false, message: `未找到书签: "${body.target}"` });
        return;
    }
    const result = await openInFileManager(entry.path);
    sendJson(res, 200, result);
}
