import { defineTool } from '@deepseek-ai/dsh-tools';
import { createProject, PROJECT_TYPES } from '../project-templates.js';
const projectTypeEnum = PROJECT_TYPES.map((t) => t.value);
export const projectCreateTool = defineTool({
    name: 'project-create',
    description: '创建一个工程。支持多种工程类型：空白文件夹、项目管理工程、代码类工程（Java、Python、Vue、DSH Plugin）、知识类工程、探索类工程、复制类工程。' +
        '项目管理工程会创建标准的项目管理目录结构；代码类工程会创建 CLAUDE.md、AGENT.md、Skills/、Docs/、Standard/ 等文件；' +
        'Vue 工程通过 npm create vite 创建；复制类工程会将源工程复制到目标位置并替换项目名称。',
    parameters: {
        basePath: {
            type: 'string',
            required: true,
            description: '目标根目录的绝对路径，工程将创建在此目录下。',
        },
        projectName: {
            type: 'string',
            required: true,
            description: '工程名称（即要创建的文件夹名称）。',
        },
        projectType: {
            type: 'string',
            required: true,
            enum: projectTypeEnum,
            description: '工程类型。可选值：empty（空白文件夹）、project-management（项目管理工程）、' +
                'code-java（Java 工程）、code-python（Python 工程）、code-vue（Vue 工程，通过 npm 创建）、' +
                'code-dsh-plugin（DSH Plugin 工程）、knowledge（知识类工程）、exploration（探索类工程）、' +
                'copy（复制类工程，需要 sourcePath）。',
        },
        sourcePath: {
            type: 'string',
            description: '源工程路径（仅 copy 类型需要）。',
        },
    },
    output: {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', required: true, description: '操作是否成功。' },
                projectPath: { type: 'string', required: true, description: '创建的工程路径。' },
                message: { type: 'string', required: true, description: '操作结果描述。' },
                details: {
                    type: 'array',
                    required: true,
                    items: { type: 'string' },
                    description: '创建过程的详细信息。',
                },
            },
            additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
        const result = await createProject({
            basePath: String(args.basePath),
            projectName: String(args.projectName),
            projectType: args.projectType,
            sourcePath: args.sourcePath != null ? String(args.sourcePath) : undefined,
        });
        return result;
    },
});
