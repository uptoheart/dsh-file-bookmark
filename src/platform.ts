import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type OpenMethod = 'folder' | 'vscode' | 'idea' | 'cmd'

export interface OpenTarget {
  command: string
  args: string[]
  shell?: boolean
  hideWindow?: boolean
}

export function openInFileManager(targetPath: string): OpenTarget {
  const platform = process.platform
  if (platform === 'win32') {
    return { command: `explorer.exe "${targetPath}"`, args: [], shell: true, hideWindow: false }
  }
  if (platform === 'darwin') return { command: 'open', args: [targetPath], hideWindow: false }
  return { command: 'xdg-open', args: [targetPath], hideWindow: false }
}

export function openInVSCode(targetPath: string): OpenTarget {
  return { command: `code "${targetPath}"`, args: [], shell: true, hideWindow: false }
}

export function openInIDEA(targetPath: string): OpenTarget {
  const platform = process.platform
  if (platform === 'win32') {
    return { command: `idea64.exe "${targetPath}"`, args: [], shell: true, hideWindow: false }
  }
  if (platform === 'darwin') {
    return { command: 'idea', args: [targetPath], hideWindow: false }
  }
  return { command: 'idea.sh', args: [targetPath], hideWindow: false }
}

export function openInCmd(targetPath: string): OpenTarget {
  const platform = process.platform
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/c', 'start', '""', 'cmd.exe', '/k', `cd /d "${targetPath}"`],
      shell: false,
      hideWindow: false,
    }
  }
  if (platform === 'darwin') {
    const script = `cd "${targetPath}"; exec bash`
    return { command: 'osascript', args: ['-e', `tell application "Terminal" to do script ${JSON.stringify(script)}`], hideWindow: false }
  }
  return { command: 'x-terminal-emulator', args: ['-e', `cd "${targetPath}"; exec bash`], hideWindow: false }
}

function spawnNoWait(target: OpenTarget): void {
  const { command, args, shell = false, hideWindow = false } = target
  const options = {
    detached: true,
    stdio: 'ignore' as const,
    windowsHide: hideWindow,
    ...(shell ? { shell: true } : {}),
  }
  let child: ReturnType<typeof spawn>
  try {
    child = spawn(command, args, options)
  } catch {
    return
  }
  child.once('error', () => {})
  child.unref()
}

export async function openByMethod(targetPath: string, method: OpenMethod): Promise<{ success: boolean; message: string }> {
  let target: OpenTarget
  let label: string

  switch (method) {
    case 'vscode':
      target = openInVSCode(targetPath)
      label = 'VS Code'
      break
    case 'idea':
      target = openInIDEA(targetPath)
      label = 'IntelliJ IDEA'
      break
    case 'cmd':
      target = openInCmd(targetPath)
      label = '终端'
      break
    case 'folder':
    default:
      target = openInFileManager(targetPath)
      label = '文件管理器'
      break
  }

  spawnNoWait(target)

  const msg = `已在 ${label} 中打开: ${targetPath}`
  return { success: true, message: msg }
}

export async function selectFolderDialog(): Promise<{ success: boolean; path: string; message: string }> {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.Description = "选择文件夹"',
        '$dialog.ShowNewFolderButton = $true',
        '$result = $dialog.ShowDialog()',
        'if ($result -eq "OK") { Write-Output $dialog.SelectedPath } else { Write-Output "__CANCELLED__" }',
      ].join('; ')
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        psScript,
      ], { timeout: 120000 })
      const path = stdout.trim()
      if (path === '__CANCELLED__' || !path) {
        return { success: false, path: '', message: '已取消选择文件夹' }
      }
      return { success: true, path, message: `已选择: ${path}` }
    }

    if (platform === 'darwin') {
      const { stdout } = await execFileAsync('osascript', [
        '-e',
        'POSIX path of (choose folder with prompt "选择文件夹")',
      ], { timeout: 120000 })
      const path = stdout.trim()
      if (!path) {
        return { success: false, path: '', message: '已取消选择文件夹' }
      }
      return { success: true, path, message: `已选择: ${path}` }
    }

    const { stdout } = await execFileAsync('zenity', [
      '--file-selection',
      '--directory',
      '--title=选择文件夹',
    ], { timeout: 120000 })
    const path = stdout.trim()
    if (!path) {
      return { success: false, path: '', message: '已取消选择文件夹' }
    }
    return { success: true, path, message: `已选择: ${path}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('cancelled') || message.includes('Cancel') || message.includes('__CANCELLED__')) {
      return { success: false, path: '', message: '已取消选择文件夹' }
    }
    return { success: false, path: '', message: `选择文件夹失败: ${message}` }
  }
}