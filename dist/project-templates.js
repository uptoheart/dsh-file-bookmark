import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
export const PROJECT_TYPES = [
    { value: 'empty', label: '空白文件夹', group: '基础' },
    { value: 'project-management', label: '项目管理工程', group: '项目管理' },
    { value: 'code-java', label: 'Java 工程', group: '代码类工程' },
    { value: 'code-python', label: 'Python 工程', group: '代码类工程' },
    { value: 'code-vue', label: 'Vue 工程', group: '代码类工程' },
    { value: 'code-dsh-plugin', label: 'DSH Plugin 工程', group: '代码类工程' },
    { value: 'knowledge', label: '知识类工程', group: '知识类工程' },
    { value: 'exploration', label: '探索类工程', group: '探索类工程' },
    { value: 'copy', label: '复制类工程', group: '复制类工程' },
];
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
];
const KNOWLEDGE_DIRS = [
    '00知识库',
    '10读书笔记',
    '20学习笔记',
    '30资料收集',
    '40实践总结',
    '99临时文件',
];
const EXPLORATION_DIRS = [
    '00探索目标',
    '10调研记录',
    '20实验方案',
    '30实验结果',
    '40分析总结',
    '99临时文件',
];
const CODE_TEMPLATE_FILES = [
    { name: 'CLAUDE.md', type: 'file', content: '# CLAUDE.md\n\n本文件用于定义 Claude 在本项目中的行为规范。\n\n## 项目概述\n\n请在此处填写项目概述。\n\n## 代码规范\n\n- 请遵循项目现有代码风格\n- 添加必要的注释\n\n## 注意事项\n\n- 提交前请确保代码通过编译\n' },
    { name: 'AGENT.md', type: 'file', content: '# AGENT.md\n\n本文件用于定义 AI Agent 在本项目中的协作规范。\n\n## 角色与职责\n\n请在此处定义 Agent 的角色与职责。\n\n## 工作流程\n\n1. 理解需求\n2. 编写代码\n3. 自测验证\n\n## 约束\n\n- 不修改核心配置文件\n- 保持代码简洁\n' },
    { name: 'Skills', type: 'folder' },
    { name: 'Docs', type: 'folder' },
    { name: 'Standard', type: 'folder' },
];
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
`;
const GITIGNORE_JAVA = `# Java
target/
*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*
`;
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
`;
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
`;
async function initGitRepo(projectPath, gitignoreExtra) {
    const details = [];
    const gitignorePath = join(projectPath, '.gitignore');
    if (!existsSync(gitignorePath)) {
        writeFileSync(gitignorePath, GITIGNORE_BASE + '\n' + gitignoreExtra, 'utf-8');
        details.push('已创建文件: .gitignore');
    }
    else {
        details.push('文件已存在: .gitignore');
    }
    try {
        await execFileAsync('git', ['init'], { cwd: projectPath, timeout: 30000 });
        details.push('已初始化 Git 仓库');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        details.push(`Git 初始化失败: ${message}`);
    }
    return details;
}
function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
function createProjectManagement(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    const details = [];
    for (const dir of PROJECT_MANAGEMENT_DIRS) {
        const dirPath = join(projectPath, dir);
        ensureDir(dirPath);
        details.push(`已创建目录: ${dir}`);
    }
    return {
        success: true,
        projectPath,
        message: `项目管理工程创建成功: ${projectPath}`,
        details,
    };
}
function createKnowledgeProject(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    const details = [];
    for (const dir of KNOWLEDGE_DIRS) {
        const dirPath = join(projectPath, dir);
        ensureDir(dirPath);
        details.push(`已创建目录: ${dir}`);
    }
    return {
        success: true,
        projectPath,
        message: `知识类工程创建成功: ${projectPath}`,
        details,
    };
}
function createExplorationProject(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    const details = [];
    for (const dir of EXPLORATION_DIRS) {
        const dirPath = join(projectPath, dir);
        ensureDir(dirPath);
        details.push(`已创建目录: ${dir}`);
    }
    return {
        success: true,
        projectPath,
        message: `探索类工程创建成功: ${projectPath}`,
        details,
    };
}
function createCodeBase(projectPath) {
    const details = [];
    for (const item of CODE_TEMPLATE_FILES) {
        const itemPath = join(projectPath, item.name);
        if (item.type === 'folder') {
            ensureDir(itemPath);
            details.push(`已创建目录: ${item.name}`);
        }
        else {
            if (!existsSync(itemPath)) {
                writeFileSync(itemPath, item.content ?? '', 'utf-8');
                details.push(`已创建文件: ${item.name}`);
            }
            else {
                details.push(`文件已存在: ${item.name}`);
            }
        }
    }
    return details;
}
async function createJavaProject(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    const details = createCodeBase(projectPath);
    const javaDirs = ['src/main/java', 'src/main/resources', 'src/test/java'];
    for (const dir of javaDirs) {
        const dirPath = join(projectPath, dir);
        ensureDir(dirPath);
        details.push(`已创建目录: ${dir}`);
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
`;
    writeFileSync(join(projectPath, 'pom.xml'), pomContent, 'utf-8');
    details.push('已创建文件: pom.xml');
    const gitDetails = await initGitRepo(projectPath, GITIGNORE_JAVA);
    details.push(...gitDetails);
    return {
        success: true,
        projectPath,
        message: `Java 工程创建成功: ${projectPath}`,
        details,
    };
}
async function createPythonProject(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    const details = createCodeBase(projectPath);
    const pyDirs = ['src', 'tests'];
    for (const dir of pyDirs) {
        const dirPath = join(projectPath, dir);
        ensureDir(dirPath);
        details.push(`已创建目录: ${dir}`);
    }
    writeFileSync(join(projectPath, 'requirements.txt'), '', 'utf-8');
    details.push('已创建文件: requirements.txt');
    const readmeContent = `# ${projectName}\n\n## 安装\n\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n## 使用\n\n请在此处填写使用说明。\n`;
    writeFileSync(join(projectPath, 'README.md'), readmeContent, 'utf-8');
    details.push('已创建文件: README.md');
    const gitDetails = await initGitRepo(projectPath, GITIGNORE_PYTHON);
    details.push(...gitDetails);
    return {
        success: true,
        projectPath,
        message: `Python 工程创建成功: ${projectPath}`,
        details,
    };
}
async function createVueProject(basePath, projectName) {
    const resolvedBase = resolve(basePath);
    ensureDir(resolvedBase);
    const projectPath = join(resolvedBase, projectName);
    if (existsSync(projectPath)) {
        return {
            success: false,
            projectPath,
            message: `目标目录已存在: ${projectPath}`,
            details: [],
        };
    }
    const details = [];
    try {
        details.push(`执行命令: npm create vite@latest ${projectName} -- --template vue-ts`);
        await execAsync(`npm create vite@latest ${projectName} -- --template vue-ts`, {
            cwd: resolvedBase,
            timeout: 120000,
        });
        details.push('Vue 工程脚手架创建完成');
        const gitDetails = await initGitRepo(projectPath, GITIGNORE_NODE);
        details.push(...gitDetails);
        return {
            success: true,
            projectPath,
            message: `Vue 工程创建成功: ${projectPath}`,
            details,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            projectPath,
            message: `Vue 工程创建失败: ${message}`,
            details,
        };
    }
}
async function createDshPluginProject(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    const details = createCodeBase(projectPath);
    const srcDir = join(projectPath, 'src');
    ensureDir(srcDir);
    details.push('已创建目录: src');
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
    };
    writeFileSync(join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
    details.push('已创建文件: package.json');
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
    };
    writeFileSync(join(projectPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');
    details.push('已创建文件: tsconfig.json');
    const indexContent = `import type { Context } from '@deepseek-ai/cordis'

export const name = '${projectName}'

export function apply(_ctx: Context) {
  console.log('[${projectName}] plugin loaded')
}
`;
    writeFileSync(join(srcDir, 'index.ts'), indexContent, 'utf-8');
    details.push('已创建文件: src/index.ts');
    const gitDetails = await initGitRepo(projectPath, GITIGNORE_NODE);
    details.push(...gitDetails);
    return {
        success: true,
        projectPath,
        message: `DSH Plugin 工程创建成功: ${projectPath}`,
        details,
    };
}
function createEmptyProject(basePath, projectName) {
    const projectPath = join(resolve(basePath), projectName);
    ensureDir(projectPath);
    return {
        success: true,
        projectPath,
        message: `空白文件夹创建成功: ${projectPath}`,
        details: [`已创建目录: ${projectPath}`],
    };
}
function renameInContent(content, oldName, newName) {
    if (!oldName)
        return content;
    return content.split(oldName).join(newName);
}
function copyDirWithRename(src, dest, oldName, newName) {
    const details = [];
    const entries = readdirSync(src);
    for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist')
            continue;
        const srcPath = join(src, entry);
        const destName = entry === oldName ? newName : entry;
        const destPath = join(dest, destName);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            ensureDir(destPath);
            details.push(`已复制目录: ${destName}`);
            const subDetails = copyDirWithRename(srcPath, destPath, oldName, newName);
            details.push(...subDetails);
        }
        else {
            try {
                let content = readFileSync(srcPath, 'utf-8');
                content = renameInContent(content, oldName, newName);
                writeFileSync(destPath, content, 'utf-8');
                details.push(`已复制文件: ${destName}`);
            }
            catch {
                cpSync(srcPath, destPath);
                details.push(`已复制文件(二进制): ${destName}`);
            }
        }
    }
    return details;
}
function createCopyProject(basePath, projectName, sourcePath) {
    const resolvedSource = resolve(sourcePath);
    if (!existsSync(resolvedSource)) {
        return {
            success: false,
            projectPath: '',
            message: `源工程不存在: ${resolvedSource}`,
            details: [],
        };
    }
    const sourceName = basename(resolvedSource);
    const projectPath = join(resolve(basePath), projectName);
    if (existsSync(projectPath)) {
        return {
            success: false,
            projectPath,
            message: `目标目录已存在: ${projectPath}`,
            details: [],
        };
    }
    ensureDir(projectPath);
    const details = copyDirWithRename(resolvedSource, projectPath, sourceName, projectName);
    return {
        success: true,
        projectPath,
        message: `复制类工程创建成功: ${projectPath}`,
        details,
    };
}
export async function createProject(options) {
    const { basePath, projectName, projectType, sourcePath } = options;
    if (!projectName.trim()) {
        return {
            success: false,
            projectPath: '',
            message: '项目名称不能为空',
            details: [],
        };
    }
    if (!basePath.trim()) {
        return {
            success: false,
            projectPath: '',
            message: '目标目录不能为空',
            details: [],
        };
    }
    switch (projectType) {
        case 'empty':
            return createEmptyProject(basePath, projectName);
        case 'project-management':
            return createProjectManagement(basePath, projectName);
        case 'code-java':
            return await createJavaProject(basePath, projectName);
        case 'code-python':
            return await createPythonProject(basePath, projectName);
        case 'code-vue':
            return await createVueProject(basePath, projectName);
        case 'code-dsh-plugin':
            return await createDshPluginProject(basePath, projectName);
        case 'knowledge':
            return createKnowledgeProject(basePath, projectName);
        case 'exploration':
            return createExplorationProject(basePath, projectName);
        case 'copy':
            if (!sourcePath) {
                return {
                    success: false,
                    projectPath: '',
                    message: '复制类工程需要指定源工程路径',
                    details: [],
                };
            }
            return createCopyProject(basePath, projectName, sourcePath);
        default:
            return {
                success: false,
                projectPath: '',
                message: `未知的项目类型: ${projectType}`,
                details: [],
            };
    }
}
