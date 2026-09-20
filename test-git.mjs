import { createProject } from './dist/project-templates.js'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'dsh-git-test-'))
console.log('Temp dir:', tmp)

const result = await createProject({
  basePath: tmp,
  projectName: 'test-java-git',
  projectType: 'code-java',
})

console.log('\n=== Result ===')
console.log('success:', result.success)
console.log('message:', result.message)
console.log('details:')
result.details.forEach(d => console.log('  ' + d))

const projectPath = result.projectPath
console.log('\n=== Verification ===')
console.log('.gitignore exists:', existsSync(join(projectPath, '.gitignore')))
console.log('.git dir exists:', existsSync(join(projectPath, '.git')))

if (existsSync(join(projectPath, '.gitignore'))) {
  const gitignore = readFileSync(join(projectPath, '.gitignore'), 'utf-8')
  console.log('\n--- .gitignore content ---')
  console.log(gitignore)
}

console.log('\n=== Project files ===')
console.log(readdirSync(projectPath))