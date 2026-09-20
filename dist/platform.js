import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export function getOpenCommand(targetPath) {
    const platform = process.platform;
    if (platform === 'win32') {
        return { command: 'explorer.exe', args: [targetPath] };
    }
    if (platform === 'darwin') {
        return { command: 'open', args: [targetPath] };
    }
    return { command: 'xdg-open', args: [targetPath] };
}
export async function openInFileManager(targetPath) {
    try {
        const { command, args } = getOpenCommand(targetPath);
        try {
            await execFileAsync(command, args, { timeout: 10000 });
        }
        catch {
            // On Windows, explorer.exe often returns a non-zero exit code even on success.
            // We treat the absence of a thrown "spawn" error as success.
            if (process.platform !== 'win32')
                throw new Error('open command failed');
        }
        return { success: true, message: `已打开: ${targetPath}` };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, message: `无法打开: ${targetPath}，错误: ${message}` };
    }
}
export async function selectFolderDialog() {
    const platform = process.platform;
    try {
        if (platform === 'win32') {
            const psScript = [
                'Add-Type -AssemblyName System.Windows.Forms',
                '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
                '$dialog.Description = "选择文件夹"',
                '$dialog.ShowNewFolderButton = $true',
                '$result = $dialog.ShowDialog()',
                'if ($result -eq "OK") { Write-Output $dialog.SelectedPath } else { Write-Output "__CANCELLED__" }',
            ].join('; ');
            const { stdout } = await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-Command',
                psScript,
            ], { timeout: 120000 });
            const path = stdout.trim();
            if (path === '__CANCELLED__' || !path) {
                return { success: false, path: '', message: '已取消选择文件夹' };
            }
            return { success: true, path, message: `已选择: ${path}` };
        }
        if (platform === 'darwin') {
            const { stdout } = await execFileAsync('osascript', [
                '-e',
                'POSIX path of (choose folder with prompt "选择文件夹")',
            ], { timeout: 120000 });
            const path = stdout.trim();
            if (!path) {
                return { success: false, path: '', message: '已取消选择文件夹' };
            }
            return { success: true, path, message: `已选择: ${path}` };
        }
        const { stdout } = await execFileAsync('zenity', [
            '--file-selection',
            '--directory',
            '--title=选择文件夹',
        ], { timeout: 120000 });
        const path = stdout.trim();
        if (!path) {
            return { success: false, path: '', message: '已取消选择文件夹' };
        }
        return { success: true, path, message: `已选择: ${path}` };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('cancelled') || message.includes('Cancel') || message.includes('__CANCELLED__')) {
            return { success: false, path: '', message: '已取消选择文件夹' };
        }
        return { success: false, path: '', message: `选择文件夹失败: ${message}` };
    }
}
