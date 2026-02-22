// manifest.ts
// basically a poor man's sqlite DB
// maps file paths to their last write time so we can skip unchanged files when indexing
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ManifestEntry {
    mtime: number;   // ms since epoch
    chunkCount: number;
}

export type Manifest = Record<string, ManifestEntry>;

// path utils

function atlasDir(): string {
    return path.join(os.homedir(), '.atlas');
}

function manifestPath(workspaceId: string): string {
    const dir = path.join(atlasDir(), 'manifests');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${workspaceId}.json`);
}

// Derive a stable workspace ID from the folder path (slugified)
export function workspaceId(folderPath: string): string {
    return folderPath
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/__+/g, '_')
        .slice(0, 80);
}

// io functions

export function loadManifest(folderPath: string): Manifest {
    const id = workspaceId(folderPath);
    const p = manifestPath(id);
    try {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8')) as Manifest;
        }
    } catch { /* corrupted manifest — start fresh */ }
    return {};
}

export function saveManifest(folderPath: string, manifest: Manifest): void {
    const id = workspaceId(folderPath);
    const p = manifestPath(id);
    fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
}

// figuring out what changed

// checks if a file needs to be re-indexed
export function needsIndexing(manifest: Manifest, filePath: string): boolean {
    const entry = manifest[filePath];
    if (!entry) return true; // never indexed
    try {
        const stat = fs.statSync(filePath);
        return stat.mtimeMs > entry.mtime;
    } catch {
        return false; // file deleted — skip
    }
}

// marks a file as processed so we don't index it again
export function markIndexed(manifest: Manifest, filePath: string, chunkCount: number): void {
    try {
        const stat = fs.statSync(filePath);
        manifest[filePath] = { mtime: stat.mtimeMs, chunkCount };
    } catch { /* ignore */ }
}

// drop files that got deleted from disk
export function removeFromManifest(manifest: Manifest, filePath: string): void {
    delete manifest[filePath];
}
