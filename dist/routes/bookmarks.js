import { readJsonBody, sendJson } from '../server-utils.js';
import { addBookmark, listBookmarks, removeBookmark } from '../bookmarks.js';
export async function handleListBookmarks(_req, res) {
    sendJson(res, 200, listBookmarks());
}
export async function handleAddBookmark(req, res) {
    const body = await readJsonBody(req);
    if (!body.path) {
        sendJson(res, 400, { success: false, message: 'path is required' });
        return;
    }
    const entry = addBookmark({
        alias: body.alias ?? body.path.split(/[/\\]/).pop() ?? body.path,
        path: body.path,
        type: body.type === 'folder' ? 'folder' : 'file',
    });
    sendJson(res, 200, { success: true, message: `已收藏: ${entry.alias}`, entry });
}
export async function handleRemoveBookmark(req, res, url) {
    const alias = decodeURIComponent(url.slice('/api/bookmarks/'.length));
    const ok = removeBookmark(alias);
    sendJson(res, 200, { success: ok, message: ok ? `已删除: ${alias}` : `未找到: ${alias}` });
}
