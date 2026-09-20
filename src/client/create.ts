// ── Feature: 创建项目 (project-create) ───────────────────────────────────────
// Owns: the "创建项目" card — project type selector + creation form + results.
import {
  apiGet,
  apiPost,
  toast,
  escapeHtml,
  type CreateProjectResult,
} from './shared.js'

const PROJECT_TYPE_OPTIONS = [
  { group: '基础', items: [{ value: 'empty', label: '空白文件夹' }] },
  { group: '项目管理', items: [{ value: 'project-management', label: '项目管理工程' }] },
  { group: '代码类工程', items: [
    { value: 'code-java', label: 'Java 工程' },
    { value: 'code-python', label: 'Python 工程' },
    { value: 'code-vue', label: 'Vue 工程（npm 创建）' },
    { value: 'code-dsh-plugin', label: 'DSH Plugin 工程' },
  ] },
  { group: '知识类工程', items: [{ value: 'knowledge', label: '知识类工程' }] },
  { group: '探索类工程', items: [{ value: 'exploration', label: '探索类工程' }] },
  { group: '复制类工程', items: [{ value: 'copy', label: '复制类工程' }] },
]

function buildProjectTypeOptions(): string {
  return PROJECT_TYPE_OPTIONS.map((g) => {
    const opts = g.items.map((i) => `<option value="${i.value}">${i.label}</option>`).join('')
    return `<optgroup label="${g.group}">${opts}</optgroup>`
  }).join('')
}

export function renderCreateCard(): string {
  return `<div class="bkm-card" id="bkm-card-create">
    <h2>🚀 创建项目</h2>
    <p class="bkm-sub">选择项目类型，一键创建标准工程结构</p>
    <div class="bkm-fg">
      <label for="bkm-project-base">目标目录</label>
      <div class="bkm-path-row">
        <input type="text" id="bkm-project-base" placeholder="C:\\projects 或 /home/me/projects">
        <button class="bkm-btn bkm-btn-s" id="bkm-select-folder-btn" type="button">📂 选择文件夹</button>
      </div>
    </div>
    <div class="bkm-fg">
      <label for="bkm-project-name">项目名称</label>
      <input type="text" id="bkm-project-name" placeholder="my-project">
    </div>
    <div class="bkm-fg">
      <label for="bkm-project-type">项目类型</label>
      <select id="bkm-project-type">${buildProjectTypeOptions()}</select>
    </div>
    <div class="bkm-fg bkm-hidden" id="bkm-source-wrap">
      <label for="bkm-source-path">源工程路径</label>
      <div class="bkm-path-row">
        <input type="text" id="bkm-source-path" placeholder="C:\\projects\\source-project">
        <button class="bkm-btn bkm-btn-s" id="bkm-select-source-btn" type="button">📂 选择</button>
      </div>
    </div>
    <button class="bkm-btn bkm-btn-primary" id="bkm-create-project-btn" type="button">🚀 创建项目</button>
    <div class="bkm-list bkm-mt10" id="bkm-project-results"></div>
  </div>`
}

export function wireCreateEvents(root: HTMLElement): void {
  root.querySelector('#bkm-select-folder-btn')?.addEventListener('click', () => handleSelectFolder('bkm-project-base'))
  root.querySelector('#bkm-select-source-btn')?.addEventListener('click', () => handleSelectFolder('bkm-source-path'))
  root.querySelector('#bkm-project-type')?.addEventListener('change', handleProjectTypeChange)
  root.querySelector('#bkm-create-project-btn')?.addEventListener('click', handleCreateProject)
}

async function handleSelectFolder(targetInputId: string): Promise<void> {
  const inputEl = document.getElementById(targetInputId) as HTMLInputElement | null
  try {
    const data = await apiGet<{ success: boolean; path: string; message: string }>('/api/select-folder')
    if (data.success && data.path) {
      if (inputEl) inputEl.value = data.path
      toast(data.message)
    } else {
      toast(data.message, false)
    }
  } catch (e) { toast('选择文件夹失败: ' + (e as Error).message, false) }
}

function handleProjectTypeChange(): void {
  const typeEl = document.getElementById('bkm-project-type') as HTMLSelectElement | null
  const sourceWrap = document.getElementById('bkm-source-wrap')
  if (!typeEl || !sourceWrap) return
  if (typeEl.value === 'copy') sourceWrap.classList.remove('bkm-hidden')
  else sourceWrap.classList.add('bkm-hidden')
}

async function handleCreateProject(): Promise<void> {
  const baseEl = document.getElementById('bkm-project-base') as HTMLInputElement | null
  const nameEl = document.getElementById('bkm-project-name') as HTMLInputElement | null
  const typeEl = document.getElementById('bkm-project-type') as HTMLSelectElement | null
  const sourceEl = document.getElementById('bkm-source-path') as HTMLInputElement | null

  const basePath = baseEl?.value.trim() ?? ''
  const projectName = nameEl?.value.trim() ?? ''
  const projectType = typeEl?.value ?? ''
  const sourcePath = sourceEl?.value.trim() ?? ''

  if (!basePath) { toast('请选择或输入目标目录', false); return }
  if (!projectName) { toast('请输入项目名称', false); return }
  if (projectType === 'copy' && !sourcePath) { toast('请输入源工程路径', false); return }

  const btn = document.getElementById('bkm-create-project-btn') as HTMLButtonElement | null
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 创建中...' }

  try {
    const data = await apiPost<CreateProjectResult>('/api/create-project', {
      basePath,
      projectName,
      projectType,
      sourcePath: projectType === 'copy' ? sourcePath : undefined,
    })
    toast(data.message, data.success)
    renderProjectResults(data)
  } catch (e) {
    toast('创建项目失败: ' + (e as Error).message, false)
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🚀 创建项目' }
  }
}

function renderProjectResults(result: CreateProjectResult): void {
  const container = document.getElementById('bkm-project-results')
  if (!container) return
  if (!result.success) {
    container.innerHTML = `<div class="bkm-item">
      <div class="bkm-item-info">
        <div class="bkm-item-name">❌ 创建失败</div>
        <div class="bkm-item-path">${escapeHtml(result.message)}</div>
      </div>
    </div>`
    return
  }
  const detailsHtml = (result.details ?? []).map((d) =>
    `<div class="bkm-detail-line">${escapeHtml(d)}</div>`,
  ).join('')
  const name = result.projectPath.split(/[/\\]/).pop() ?? result.projectPath
  container.innerHTML = `<div class="bkm-item">
      <div class="bkm-item-info">
        <div class="bkm-item-name">✅ ${escapeHtml(name)}</div>
        <div class="bkm-item-path">${escapeHtml(result.projectPath)}</div>
      </div>
      <span class="bkm-badge bkm-badge-folder">project</span>
    </div>
    <div class="bkm-project-results">${detailsHtml}</div>`
}