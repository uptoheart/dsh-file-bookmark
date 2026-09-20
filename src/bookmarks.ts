import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface BookmarkEntry {
  id: string
  alias: string
  path: string
  type: 'file' | 'folder'
  createdAt: string
  openCount: number
}

function getStorageDir(): string {
  return join(homedir(), '.dsh-file-bookmark')
}

function getBookmarksFilePath(): string {
  return join(getStorageDir(), 'bookmarks.json')
}

function ensureStorageDir(): void {
  const dir = getStorageDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function normalizeEntry(entry: Partial<BookmarkEntry>): BookmarkEntry {
  return {
    id: entry.id ?? '',
    alias: entry.alias ?? '',
    path: entry.path ?? '',
    type: entry.type === 'folder' ? 'folder' : 'file',
    createdAt: entry.createdAt ?? new Date().toISOString(),
    openCount: typeof entry.openCount === 'number' ? entry.openCount : 0,
  }
}

export function loadBookmarks(): BookmarkEntry[] {
  const filePath = getBookmarksFilePath()
  if (!existsSync(filePath)) {
    return []
  }
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      return data.map((d: Partial<BookmarkEntry>) => normalizeEntry(d))
    }
    return []
  } catch {
    return []
  }
}

export function saveBookmarks(bookmarks: BookmarkEntry[]): void {
  ensureStorageDir()
  const filePath = getBookmarksFilePath()
  writeFileSync(filePath, JSON.stringify(bookmarks, null, 2), 'utf-8')
}

export function addBookmark(entry: Omit<BookmarkEntry, 'id' | 'createdAt' | 'openCount'>): BookmarkEntry {
  const bookmarks = loadBookmarks()
  const existing = bookmarks.find((b) => b.alias === entry.alias)
  if (existing) {
    existing.path = entry.path
    existing.type = entry.type
    saveBookmarks(bookmarks)
    return existing
  }
  const newEntry: BookmarkEntry = {
    ...entry,
    id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    openCount: 0,
  }
  bookmarks.push(newEntry)
  saveBookmarks(bookmarks)
  return newEntry
}

export function removeBookmark(alias: string): boolean {
  const bookmarks = loadBookmarks()
  const idx = bookmarks.findIndex((b) => b.alias === alias)
  if (idx === -1) return false
  bookmarks.splice(idx, 1)
  saveBookmarks(bookmarks)
  return true
}

export function findBookmark(aliasOrId: string): BookmarkEntry | undefined {
  const bookmarks = loadBookmarks()
  return bookmarks.find((b) => b.alias === aliasOrId || b.id === aliasOrId)
}

export function incrementOpenCount(aliasOrId: string): BookmarkEntry | undefined {
  const bookmarks = loadBookmarks()
  const entry = bookmarks.find((b) => b.alias === aliasOrId || b.id === aliasOrId)
  if (!entry) return undefined
  entry.openCount = (entry.openCount ?? 0) + 1
  saveBookmarks(bookmarks)
  return entry
}

export function listBookmarks(): BookmarkEntry[] {
  return loadBookmarks().sort((a, b) => (b.openCount ?? 0) - (a.openCount ?? 0))
}