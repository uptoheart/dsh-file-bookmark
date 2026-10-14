# dsh-file-bookmark

DeepSeek Harness 插件：文件收藏 & 快速打开，支持文件夹、VS Code、IDEA、CMD 四种打开方式。

## 开发

```sh
# 安装依赖
pnpm install

# 构建（tsc + client.js 包装 + ui.html 拷贝到 dist/）
npm run build

# 类型检查（不产出文件）
npm run typecheck

# 启动 DSH web 并加载本插件（必须在插件根目录执行）
dsh web --patch .\cordis.patch.yml
```

插件通过 symlink 安装在 `~/.dsh/profiles/web/node_modules/dsh-file-bookmark`，
指向项目根目录，所以每次 `npm run build` 后 DSH 自动加载最新 dist，无需重新安装插件。

浏览器打开 DSH 界面后按 **Ctrl+Shift+R** 可强制刷新 client.js。

## 项目结构

```
src/
  server.ts           # HTTP server (127.0.0.1:17319)，提供 API + UI
  server-utils.ts     # sendJson / sendHtml / readJsonBody 等工具
  platform.ts         # 跨平台 spawn（explorer / code / idea / cmd）
  client/
    shared.ts         # 浏览器端 discoverServer() — 探测后端端口
    panel.ts          # 官方 panel 模式 iframe 挂载
  routes/
    open.ts           # POST /api/open — 用四种方式打开路径
    bookmarks.ts      # GET/POST/DELETE /api/bookmarks
    workspaces.ts     # GET/POST/DELETE /api/workspaces
  ui.html             # 面板 UI（后端启动时读入内存）
  index.ts            # DSH 插件入口：startServer() + 注册 tool
dist/                 # 构建产物（symlink 到 DSH profiles）
```

## API

所有接口均启用 CORS（动态回写 `Origin`），仅监听 `127.0.0.1`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 返回 ui.html |
| GET | `/api/bookmarks` | 收藏列表 |
| POST | `/api/bookmarks` | 新建收藏 `{ name, path }` |
| DELETE | `/api/bookmarks/:id` | 删除收藏 |
| GET | `/api/workspaces` | 工作区列表 |
| POST | `/api/workspaces` | 新建工作区 |
| DELETE | `/api/workspaces/:id` | 删除工作区 |
| POST | `/api/open` | 用指定方式打开 `{ path, method }` method ∈ folder / vscode / idea / cmd |
| POST | `/api/select-folder` | 弹出系统文件夹选择对话框 |

## 注意事项

- spawn 异步错误必须 `.once('error', () => {})` 吞掉，否则 Node.js 进程会崩溃
- Windows 下 VS Code spawn 需要 `shell: true`，因为 `code` 是 `code.cmd`
- cmd.exe / explorer.exe 打开要 `windowsHide: false`，否则窗口被隐藏
- ui.html 是 server 启动时读入内存的，改完后需要重启 DSH 才生效