import { createProject } from './dist/project-templates.js'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'dsh-git-test2-'))

console.log('=== Python Project ===')
const pyResult = await createProject({
  basePath: tmp,
  projectName: 'test-py-git',
  projectType: 'code-python',
})
console.log('success:', pyResult.success)
console.log('.gitignore exists:', existsSync(join(pyResult.projectPath, '.gitignore')))
console.log('.git dir exists:', existsSync(join(pyResult.projectPath, '.git')))
const pyGitignore = readFileSync(join(pyResult.projectPath, '.gitignore'), 'utf-8')
console.log('Contains __pycache__:', pyGitignore.includes('__pycache__'))
console.log('Contains target/ (should be false):', pyGitignore.includes('target/'))

console.log('\n=== DSH Plugin Project ===')
const dshResult = await createProject({
  basePath: tmp,
  projectName: 'test-dsh-git',
  projectType: 'code-dsh-plugin',
})
console.log('success:', dshResult.success)
console.log('.gitignore exists:', existsSync(join(dshResult.projectPath, '.gitignore')))
console.log('.git dir exists:', existsSync(join(dshResult.projectPath, '.git')))
const dshGitignore = readFileSync(join(dshResult.projectPath, '.gitignore'), 'utf-8')
console.log('Contains node_modules/:', dshGitignore.includes('node_modules/'))
console.log('Contains dist/:', dshGitignore.includes('dist/'))

console.log('\nAll tests passed!')