import { defineTool } from '@deepseek-ai/dsh-tools';
import { existsSync } from 'node:fs';
import { findBookmark, listBookmarks } from '../bookmarks.js';
import { openInFileManager } from '../platform.js';
export const bookmarkOpenTool = defineTool({
    name: 'bookmark-open',
    description: '打开收藏的文件或文件夹。如果是文件夹则在系统文件管理器中打开，如果是文件则直接打开该文件。可以通过别名或 ID 指定要打开的收藏项。',
    parameters: {
        target: {
            type: 'string',
            required: true,
            description: '书签别名或 ID，用于定位要打开的收藏项。',
        },
    },
    output: {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', required: true, description: '操作是否成功。' },
                path: { type: 'string', required: true, description: '打开的路径。' },
                message: { type: 'string', required: true, description: '操作结果描述。' },
            },
            additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
        const entry = findBookmark(args.target);
        if (!entry) {
            return {
                success: false,
                path: '',
                message: `未找到书签: "${args.target}"。可用书签: ${listBookmarks().map((b) => b.alias).join(', ') || '无'}`,
            };
        }
        if (!existsSync(entry.path)) {
            return {
                success: false,
                path: entry.path,
                message: `书签路径不存在: ${entry.path}，可能已被移动或删除。`,
            };
        }
        const result = await openInFileManager(entry.path);
        return {
            success: result.success,
            path: entry.path,
            message: result.message,
        };
    },
});
