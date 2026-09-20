import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { addBookmark } from '../bookmarks.js'

export const bookmarkAddTool = defineTool({
  name: 'bookmark-add',
  description:
    '添加文件或文件夹到书签收藏。可以指定别名方便后续打开。如果别名已存在则更新路径。',

  parameters: {
    path: {
      type: 'string',
      required: true,
      description: '要收藏的文件或文件夹的绝对路径。',
    },
    alias: {
      type: 'string',
      description: '书签别名，用于快速识别。不提供时自动使用路径的最后一个部分。',
    },
    type: {
      type: 'string',
      enum: ['file', 'folder'],
      description: '明确指定是文件还是文件夹。不提供时自动检测。',
    },
  },

  output: {
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', required: true, description: '操作是否成功。' },
        id: { type: 'string', required: true, description: '书签唯一 ID。' },
        alias: { type: 'string', required: true, description: '书签别名。' },
        path: { type: 'string', required: true, description: '收藏的路径。' },
        type: { type: 'string', required: true, description: '类型（file 或 folder）。' },
        message: { type: 'string', required: true, description: '操作结果描述。' },
      },
      additionalProperties: false,
    },
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  },

  async execute(args) {
    const resolvedPath = resolve(args.path)
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        id: '',
        alias: args.alias ?? '',
        path: resolvedPath,
        type: args.type ?? 'file',
        message: `路径不存在: ${resolvedPath}`,
      }
    }

    const detectedType = args.type ?? 'file'
    const alias = args.alias ?? resolvedPath.split(/[/\\]/).pop() ?? resolvedPath

    try {
      const entry = addBookmark({
        alias,
        path: resolvedPath,
        type: detectedType,
      })
      return {
        success: true,
        id: entry.id,
        alias: entry.alias,
        path: entry.path,
        type: entry.type,
        message: `已收藏: ${entry.alias} → ${entry.path}`,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        id: '',
        alias,
        path: resolvedPath,
        type: detectedType,
        message: `收藏失败: ${msg}`,
      }
    }
  },
})