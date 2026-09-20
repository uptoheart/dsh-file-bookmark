import { bookmarkAddTool } from './tools/add.js';
import { bookmarkOpenTool } from './tools/open.js';
import { projectCreateTool } from './tools/create.js';
import { startServer } from './server.js';
export const name = 'dsh-file-bookmark';
export const inject = ['tools'];
const TOOLS = [bookmarkAddTool, bookmarkOpenTool, projectCreateTool];
export async function apply(ctx) {
    for (const tool of TOOLS) {
        ctx.tools.register(tool);
    }
    try {
        const { url } = await startServer();
        console.log(`[dsh-file-bookmark] UI 界面已启动: ${url}`);
        console.log(`[dsh-file-bookmark] 已注册 ${TOOLS.length} 个工具: ${TOOLS.map((t) => t.name).join(', ')}`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[dsh-file-bookmark] 启动 UI 服务失败: ${message}`);
    }
}
