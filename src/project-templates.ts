import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const DSH_WORKSPACE_JSON = join(homedir(), '.dsh', 'storages', 'workspace.json')
const DSH_SESSIONS_DIR = join(homedir(), '.dsh', 'sessions')

function toSessionDirName(wsPath: string): string {
  const resolved = resolve(wsPath)
  const isWin = process.platform === 'win32'
  const sep = isWin ? /[\\/]/g : /\//g
  let parts = resolved.split(sep).filter(Boolean)
  if (isWin && parts.length > 0 && /^[A-Za-z]:$/.test(parts[0])) {
    parts[0] = parts[0].replace(':', '')
  }
  const normalized = parts.join('-')
  return `${normalized}--`
}

interface DshWorkspaceEntry {
  path: string
  title: string
  sessionIds: string[]
  createdAt: string
  updatedAt: string
}

interface DshWorkspaceJson {
  unit?: { name: string; version: number }
  global?: {
    initialized?: boolean
    workspaceIds?: string[]
    archivedSessionIds?: string[]
    pinnedSessionIds?: string[]
  }
  tables?: {
    workspaces?: Record<string, DshWorkspaceEntry>
  }
}

function readDshWorkspaceJson(): DshWorkspaceJson {
  try {
    if (!existsSync(DSH_WORKSPACE_JSON)) return {}
    const raw = readFileSync(DSH_WORKSPACE_JSON, 'utf8')
    return JSON.parse(raw) as DshWorkspaceJson
  } catch {
    return {}
  }
}

function writeDshWorkspaceJson(data: DshWorkspaceJson): void {
  try {
    writeFileSync(DSH_WORKSPACE_JSON, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('[dsh-file-bookmark] 写入 workspace.json 失败:', err)
  }
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function listDshWorkspaces(): WorkspaceInfo[] {
  const data = readDshWorkspaceJson()
  const workspaces: WorkspaceInfo[] = []
  const entries = data.tables?.workspaces ?? {}
  const ids = data.global?.workspaceIds ?? []

  for (const id of ids) {
    const entry = entries[id]
    if (!entry) continue
    const resolvedPath = resolve(entry.path)
    if (!existsSync(resolvedPath)) continue
    const stat = statSync(resolvedPath)
    if (!stat.isDirectory()) continue

    let items: WorkspaceItem[] = []
    try {
      items = collectWorkspaceItems(resolvedPath)
    } catch { /* ignore */ }

    workspaces.push({
      path: resolvedPath,
      name: entry.title || basename(resolvedPath),
      createdAt: entry.createdAt || stat.birthtime.toISOString(),
      items,
    })
  }

  workspaces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return workspaces
}

export function registerDshWorkspace(workspacePath: string, title?: string): boolean {
  const resolvedPath = resolve(workspacePath)
  if (!existsSync(resolvedPath)) {
    console.error('[dsh-file-bookmark] 注册工作区失败: 路径不存在', resolvedPath)
    return false
  }

  let data = readDshWorkspaceJson()
  if (!data.unit) data.unit = { name: 'workspace', version: 2 }
  if (!data.global) data.global = {}
  if (!data.global.workspaceIds) data.global.workspaceIds = []
  if (!data.tables) data.tables = {}
  if (!data.tables.workspaces) data.tables.workspaces = {}

  const entry = Object.values(data.tables.workspaces).find(
    (e) => resolve(e.path) === resolvedPath
  )

  if (!entry) {
    const id = uuidv4()
    const now = new Date().toISOString()
    data.tables.workspaces[id] = {
      path: resolvedPath,
      title: title || basename(resolvedPath),
      sessionIds: [],
      createdAt: now,
      updatedAt: now,
    }
    data.global.workspaceIds.push(id)
    writeDshWorkspaceJson(data)
  }

  try {
    const sessionDirName = toSessionDirName(resolvedPath)
    const sessionDir = join(DSH_SESSIONS_DIR, sessionDirName)
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }
  } catch (err) {
    console.warn('[dsh-file-bookmark] 创建 sessions 目录失败:', err)
  }

  return true
}

export type ProjectType =
  | 'empty'
  | 'project-management'
  | 'code-java'
  | 'code-python'
  | 'code-vue'
  | 'code-dsh-plugin'
  | 'knowledge'
  | 'exploration'
  | 'copy'

export const PROJECT_TYPES: Array<{ value: ProjectType; label: string; group: string }> = [
  { value: 'empty', label: '工作区', group: '基础' },
  { value: 'project-management', label: '项目管理工程', group: '项目管理' },
  { value: 'code-java', label: 'Java 工程', group: '代码类工程' },
  { value: 'code-python', label: 'Python 工程', group: '代码类工程' },
  { value: 'code-vue', label: 'Vue 工程', group: '代码类工程' },
  { value: 'code-dsh-plugin', label: 'DSH Plugin 工程', group: '代码类工程' },
  { value: 'knowledge', label: '知识类工程', group: '知识类工程' },
  { value: 'exploration', label: '探索类工程', group: '探索类工程' },
  { value: 'copy', label: '复制类工程', group: '复制类工程' },
]

export interface WorkspaceItem {
  name: string
  path: string
  isDirectory: boolean
}

export interface WorkspaceInfo {
  path: string
  name: string
  createdAt: string
  items: WorkspaceItem[]
}

export interface CreateProjectOptions {
  basePath: string
  projectName: string
  projectType: ProjectType
  sourcePath?: string
}

export interface CreateProjectResult {
  success: boolean
  projectPath: string
  message: string
  details: string[]
}

const PROJECT_MANAGEMENT_DIRS = [
  '00项目规划',
  '10立项',
  '20合同及里程碑',
  '30需求分析',
  '40系统设计',
  '50系统开发',
  '60系统测试',
  '70系统交付',
  '80系统运行',
  '86系统总结',
  '91客户文件',
  '92学习资料',
  '93资源申请',
  '95会议纪要',
  '96流程图',
  '97申报',
  '99临时文件',
]

const KNOWLEDGE_DIRS = [
  '00知识库',
  '10读书笔记',
  '20学习笔记',
  '30资料收集',
  '40实践总结',
  '99临时文件',
]

const EXPLORATION_DIRS = [
  '00探索目标',
  '10调研记录',
  '20实验方案',
  '30实验结果',
  '40分析总结',
  '99临时文件',
]

const CODE_TEMPLATE_FILES: Array<{ name: string; type: 'file' | 'folder'; content?: string }> = [
  { name: 'CLAUDE.md', type: 'file', content: '# CLAUDE.md\n\n本文件用于定义 Claude 在本项目中的行为规范。\n\n## 项目概述\n\n请在此处填写项目概述。\n\n## 代码规范\n\n- 请遵循项目现有代码风格\n- 添加必要的注释\n\n## 注意事项\n\n- 提交前请确保代码通过编译\n' },
  { name: 'AGENT.md', type: 'file', content: '# AGENT.md\n\n本文件用于定义 AI Agent 在本项目中的协作规范。\n\n## 角色与职责\n\n请在此处定义 Agent 的角色与职责。\n\n## 工作流程\n\n1. 理解需求\n2. 编写代码\n3. 自测验证\n\n## 约束\n\n- 不修改核心配置文件\n- 保持代码简洁\n' },
  { name: 'Skills', type: 'folder' },
  { name: 'Docs', type: 'folder' },
  { name: 'Standard', type: 'folder' },
]

const GITIGNORE_BASE = `# OS files
.DS_Store
Thumbs.db
desktop.ini

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
logs/
`

const GITIGNORE_JAVA = `# Java
target/
*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*
`

const GITIGNORE_PYTHON = `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.venv/
venv/
env/
ENV/
`

const GITIGNORE_NODE = `# Node.js
node_modules/
dist/
build/
.npm
.env
.env.local
.env.*.local
coverage/
.nyc_output/
.cache/
`

async function initGitRepo(projectPath: string, gitignoreExtra: string): Promise<string[]> {
  const details: string[] = []
  const gitignorePath = join(projectPath, '.gitignore')
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE_BASE + '\n' + gitignoreExtra, 'utf-8')
    details.push('已创建文件: .gitignore')
  } else {
    details.push('文件已存在: .gitignore')
  }

  try {
    await execFileAsync('git', ['init'], { cwd: projectPath, timeout: 30000 })
    details.push('已初始化 Git 仓库')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    details.push(`Git 初始化失败: ${message}`)
  }

  return details
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function createProjectManagement(basePath: string, projectName: string): CreateProjectResult {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  const details: string[] = []
  for (const dir of PROJECT_MANAGEMENT_DIRS) {
    const dirPath = join(projectPath, dir)
    ensureDir(dirPath)
    details.push(`已创建目录: ${dir}`)
  }
  return {
    success: true,
    projectPath,
    message: `项目管理工程创建成功: ${projectPath}`,
    details,
  }
}

function createKnowledgeProject(basePath: string, projectName: string): CreateProjectResult {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  const details: string[] = []
  for (const dir of KNOWLEDGE_DIRS) {
    const dirPath = join(projectPath, dir)
    ensureDir(dirPath)
    details.push(`已创建目录: ${dir}`)
  }
  return {
    success: true,
    projectPath,
    message: `知识类工程创建成功: ${projectPath}`,
    details,
  }
}

function createExplorationProject(basePath: string, projectName: string): CreateProjectResult {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  const details: string[] = []
  for (const dir of EXPLORATION_DIRS) {
    const dirPath = join(projectPath, dir)
    ensureDir(dirPath)
    details.push(`已创建目录: ${dir}`)
  }
  return {
    success: true,
    projectPath,
    message: `探索类工程创建成功: ${projectPath}`,
    details,
  }
}

function createCodeBase(projectPath: string): string[] {
  const details: string[] = []
  for (const item of CODE_TEMPLATE_FILES) {
    const itemPath = join(projectPath, item.name)
    if (item.type === 'folder') {
      ensureDir(itemPath)
      details.push(`已创建目录: ${item.name}`)
    } else {
      if (!existsSync(itemPath)) {
        writeFileSync(itemPath, item.content ?? '', 'utf-8')
        details.push(`已创建文件: ${item.name}`)
      } else {
        details.push(`文件已存在: ${item.name}`)
      }
    }
  }
  return details
}

async function createJavaProject(basePath: string, projectName: string): Promise<CreateProjectResult> {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  const details = createCodeBase(projectPath)

  const javaDirs = ['src/main/java', 'src/main/resources', 'src/test/java']
  for (const dir of javaDirs) {
    const dirPath = join(projectPath, dir)
    ensureDir(dirPath)
    details.push(`已创建目录: ${dir}`)
  }

  const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>${projectName}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <name>${projectName}</name>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
</project>
`
  writeFileSync(join(projectPath, 'pom.xml'), pomContent, 'utf-8')
  details.push('已创建文件: pom.xml')

  const gitDetails = await initGitRepo(projectPath, GITIGNORE_JAVA)
  details.push(...gitDetails)

  return {
    success: true,
    projectPath,
    message: `Java 工程创建成功: ${projectPath}`,
    details,
  }
}

async function createPythonProject(basePath: string, projectName: string): Promise<CreateProjectResult> {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  const details = createCodeBase(projectPath)

  const pyDirs = ['src', 'tests']
  for (const dir of pyDirs) {
    const dirPath = join(projectPath, dir)
    ensureDir(dirPath)
    details.push(`已创建目录: ${dir}`)
  }

  writeFileSync(join(projectPath, 'requirements.txt'), '', 'utf-8')
  details.push('已创建文件: requirements.txt')

  const readmeContent = `# ${projectName}\n\n## 安装\n\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n## 使用\n\n请在此处填写使用说明。\n`
  writeFileSync(join(projectPath, 'README.md'), readmeContent, 'utf-8')
  details.push('已创建文件: README.md')

  const gitDetails = await initGitRepo(projectPath, GITIGNORE_PYTHON)
  details.push(...gitDetails)

  return {
    success: true,
    projectPath,
    message: `Python 工程创建成功: ${projectPath}`,
    details,
  }
}

async function createVueProject(basePath: string, projectName: string): Promise<CreateProjectResult> {
  const resolvedBase = resolve(basePath)
  ensureDir(resolvedBase)
  const projectPath = join(resolvedBase, projectName)

  if (existsSync(projectPath)) {
    return {
      success: false,
      projectPath,
      message: `目标目录已存在: ${projectPath}`,
      details: [],
    }
  }

  const details: string[] = []
  try {
    details.push(`执行命令: npm create vite@latest ${projectName} -- --template vue-ts`)
    await execAsync(`npm create vite@latest ${projectName} -- --template vue-ts`, {
      cwd: resolvedBase,
      timeout: 120000,
    })
    details.push('Vue 工程脚手架创建完成')

    const gitDetails = await initGitRepo(projectPath, GITIGNORE_NODE)
    details.push(...gitDetails)

    return {
      success: true,
      projectPath,
      message: `Vue 工程创建成功: ${projectPath}`,
      details,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      projectPath,
      message: `Vue 工程创建失败: ${message}`,
      details,
    }
  }
}

async function createDshPluginProject(basePath: string, projectName: string): Promise<CreateProjectResult> {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  const details = createCodeBase(projectPath)

  const srcDir = join(projectPath, 'src')
  ensureDir(srcDir)
  details.push('已创建目录: src')

  const packageJson = {
    name: projectName,
    version: '0.1.0',
    description: `${projectName} — a DSH plugin.`,
    type: 'module',
    main: './dist/index.js',
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc -p tsconfig.json --noEmit',
    },
    peerDependencies: {
      '@deepseek-ai/cordis': '^4.0.2',
    },
    devDependencies: {
      '@deepseek-ai/cordis': '^4.0.2',
      '@types/node': '^22.10.0',
      typescript: '^5.6.0',
    },
  }
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8')
  details.push('已创建文件: package.json')

  const tsconfig = {
    compilerOptions: {
      target: 'es2022',
      module: 'esnext',
      moduleResolution: 'bundler',
      lib: ['es2022', 'dom'],
      types: ['node'],
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src'],
  }
  writeFileSync(join(projectPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8')
  details.push('已创建文件: tsconfig.json')

  const indexContent = `import type { Context } from '@deepseek-ai/cordis'

export const name = '${projectName}'

export function apply(_ctx: Context) {
  console.log('[${projectName}] plugin loaded')
}
`
  writeFileSync(join(srcDir, 'index.ts'), indexContent, 'utf-8')
  details.push('已创建文件: src/index.ts')

  const gitDetails = await initGitRepo(projectPath, GITIGNORE_NODE)
  details.push(...gitDetails)

  return {
    success: true,
    projectPath,
    message: `DSH Plugin 工程创建成功: ${projectPath}`,
    details,
  }
}

function resolveProjectPath(basePath: string, projectName: string): string {
  const resolvedBase = resolve(basePath)
  const childPath = join(resolvedBase, projectName)
  try {
    const baseStat = statSync(resolvedBase)
    if (baseStat.isDirectory() && basename(resolvedBase).toLowerCase() === projectName.toLowerCase()) {
      return resolvedBase
    }
  } catch {
    // basePath doesn't exist yet, fallback to join
  }
  return childPath
}

function createEmptyProject(basePath: string, projectName: string): CreateProjectResult {
  const projectPath = resolveProjectPath(basePath, projectName)
  ensureDir(projectPath)
  
  const details: string[] = [`已创建目录: ${projectPath}`]
  
  return {
    success: true,
    projectPath,
    message: `工作区创建成功: ${projectPath}`,
    details,
  }
}

function renameInContent(content: string, oldName: string, newName: string): string {
  if (!oldName) return content
  return content.split(oldName).join(newName)
}

function copyDirWithRename(src: string, dest: string, oldName: string, newName: string): string[] {
  const details: string[] = []
  const entries = readdirSync(src)
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
    const srcPath = join(src, entry)
    const destName = entry === oldName ? newName : entry
    const destPath = join(dest, destName)
    const stat = statSync(srcPath)
    if (stat.isDirectory()) {
      ensureDir(destPath)
      details.push(`已复制目录: ${destName}`)
      const subDetails = copyDirWithRename(srcPath, destPath, oldName, newName)
      details.push(...subDetails)
    } else {
      try {
        let content = readFileSync(srcPath, 'utf-8')
        content = renameInContent(content, oldName, newName)
        writeFileSync(destPath, content, 'utf-8')
        details.push(`已复制文件: ${destName}`)
      } catch {
        cpSync(srcPath, destPath)
        details.push(`已复制文件(二进制): ${destName}`)
      }
    }
  }
  return details
}

function createCopyProject(
  basePath: string,
  projectName: string,
  sourcePath: string,
): CreateProjectResult {
  const resolvedSource = resolve(sourcePath)
  if (!existsSync(resolvedSource)) {
    return {
      success: false,
      projectPath: '',
      message: `源工程不存在: ${resolvedSource}`,
      details: [],
    }
  }

  const sourceName = basename(resolvedSource)
  const projectPath = resolveProjectPath(basePath, projectName)

  if (existsSync(projectPath)) {
    return {
      success: false,
      projectPath,
      message: `目标目录已存在: ${projectPath}`,
      details: [],
    }
  }

  ensureDir(projectPath)
  const details = copyDirWithRename(resolvedSource, projectPath, sourceName, projectName)

  return {
    success: true,
    projectPath,
    message: `复制类工程创建成功: ${projectPath}`,
    details,
  }
}

export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
  const { basePath, projectName, projectType, sourcePath } = options

  if (!projectName.trim()) {
    return {
      success: false,
      projectPath: '',
      message: '项目名称不能为空',
      details: [],
    }
  }

  if (!basePath.trim()) {
    return {
      success: false,
      projectPath: '',
      message: '目标目录不能为空',
      details: [],
    }
  }

  switch (projectType) {
    case 'empty':
      return createEmptyProject(basePath, projectName)
    case 'project-management':
      return createProjectManagement(basePath, projectName)
    case 'code-java':
      return await createJavaProject(basePath, projectName)
    case 'code-python':
      return await createPythonProject(basePath, projectName)
    case 'code-vue':
      return await createVueProject(basePath, projectName)
    case 'code-dsh-plugin':
      return await createDshPluginProject(basePath, projectName)
    case 'knowledge':
      return createKnowledgeProject(basePath, projectName)
    case 'exploration':
      return createExplorationProject(basePath, projectName)
    case 'copy':
      if (!sourcePath) {
        return {
          success: false,
          projectPath: '',
          message: '复制类工程需要指定源工程路径',
          details: [],
        }
      }
      return createCopyProject(basePath, projectName, sourcePath)
    default:
      return {
        success: false,
        projectPath: '',
        message: `未知的项目类型: ${projectType}`,
        details: [],
      }
  }
}

const WORKSPACE_MARKER_DIRS = ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90', '91', '92', '93', '95', '96', '97', '99']
const WORKSPACE_MARKER_NAMES = ['规划', '立项', '开发', '管理', '知识', '探索']
const CODE_MARKER_FILES = ['package.json', 'pom.xml', 'requirements.txt', 'Cargo.toml', 'go.mod', '.git', 'CLAUDE.md', 'AGENT.md']

function collectWorkspaceItems(dirPath: string): WorkspaceItem[] {
  let entries: string[] = []
  try { entries = readdirSync(dirPath) } catch { return [] }
  return entries
    .filter(name => !name.startsWith('.') || name === '.git')
    .map(name => {
      const p = join(dirPath, name)
      try {
        const s = statSync(p)
        return { name, path: p, isDirectory: s.isDirectory() }
      } catch {
        return { name, path: p, isDirectory: false }
      }
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

function isWorkspaceDir(dirPath: string): boolean {
  let entries: string[] = []
  try { entries = readdirSync(dirPath) } catch { return false }
  if (entries.length === 0) return false

  const dirNames = entries.filter(name => {
    try {
      const s = statSync(join(dirPath, name))
      return s.isDirectory()
    } catch { return false }
  })

  const hasMarkerDir = dirNames.some(d => {
    const prefix = d.substring(0, 2)
    if (WORKSPACE_MARKER_DIRS.includes(prefix)) return true
    return WORKSPACE_MARKER_NAMES.some(n => d.includes(n))
  })
  if (hasMarkerDir) return true

  const hasCodeMarker = entries.some(e => CODE_MARKER_FILES.includes(e))
  if (hasCodeMarker) return true

  const dirCount = dirNames.length
  const fileCount = entries.length - dirCount
  if (dirCount >= 2 && entries.length >= 4) return true

  if (entries.length >= 6) return true

  return false
}

function buildWorkspaceInfo(dirPath: string): WorkspaceInfo | null {
  let stat
  try { stat = statSync(dirPath) } catch { return null }
  if (!stat.isDirectory()) return null
  if (!isWorkspaceDir(dirPath)) return null
  return {
    path: resolve(dirPath),
    name: basename(dirPath),
    createdAt: stat.birthtime.toISOString(),
    items: collectWorkspaceItems(dirPath),
  }
}

export function detectWorkspaces(basePath: string): WorkspaceInfo[] {
  const resolvedBase = resolve(basePath)
  const workspaces: WorkspaceInfo[] = []
  
  if (!existsSync(resolvedBase)) {
    return workspaces
  }

  const baseAsWorkspace = buildWorkspaceInfo(resolvedBase)
  if (baseAsWorkspace) {
    workspaces.push(baseAsWorkspace)
    return workspaces
  }

  let entries: string[] = []
  try { entries = readdirSync(resolvedBase) } catch { return workspaces }
  
  for (const entry of entries) {
    const entryPath = join(resolvedBase, entry)
    const ws = buildWorkspaceInfo(entryPath)
    if (ws) workspaces.push(ws)
  }
  
  workspaces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return workspaces
}

export function getWorkspaceProjects(workspacePath: string): string[] {
  const resolvedPath = resolve(workspacePath)
  if (!existsSync(resolvedPath)) {
    return []
  }
  
  try {
    const entries = readdirSync(resolvedPath)
    return entries.filter(entry => {
      const entryPath = join(resolvedPath, entry)
      return statSync(entryPath).isDirectory() && !entry.match(/^\d{2}/)
    })
  } catch {
    return []
  }
}