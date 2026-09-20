import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
function getStorageDir() {
    return join(homedir(), '.dsh-file-bookmark');
}
function getBookmarksFilePath() {
    return join(getStorageDir(), 'bookmarks.json');
}
function ensureStorageDir() {
    const dir = getStorageDir();
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
export function loadBookmarks() {
    const filePath = getBookmarksFilePath();
    if (!existsSync(filePath)) {
        return [];
    }
    try {
        const raw = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            return data;
        }
        return [];
    }
    catch {
        return [];
    }
}
export function saveBookmarks(bookmarks) {
    ensureStorageDir();
    const filePath = getBookmarksFilePath();
    writeFileSync(filePath, JSON.stringify(bookmarks, null, 2), 'utf-8');
}
export function addBookmark(entry) {
    const bookmarks = loadBookmarks();
    const existing = bookmarks.find((b) => b.alias === entry.alias);
    if (existing) {
        existing.path = entry.path;
        existing.type = entry.type;
        saveBookmarks(bookmarks);
        return existing;
    }
    const newEntry = {
        ...entry,
        id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
    };
    bookmarks.push(newEntry);
    saveBookmarks(bookmarks);
    return newEntry;
}
export function removeBookmark(alias) {
    const bookmarks = loadBookmarks();
    const idx = bookmarks.findIndex((b) => b.alias === alias);
    if (idx === -1)
        return false;
    bookmarks.splice(idx, 1);
    saveBookmarks(bookmarks);
    return true;
}
export function findBookmark(aliasOrId) {
    const bookmarks = loadBookmarks();
    return bookmarks.find((b) => b.alias === aliasOrId || b.id === aliasOrId);
}
export function listBookmarks() {
    return loadBookmarks();
}
