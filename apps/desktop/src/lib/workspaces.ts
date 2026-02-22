export interface Workspace {
    id: string;
    name: string;
    folderPath: string;
    model: string;
    indexedAt: number;
}

const KEY = 'atlas_workspaces';
const ACTIVE_KEY = 'atlas_active_workspace';

export function loadWorkspaces(): Workspace[] {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveWorkspaces(workspaces: Workspace[]): void {
    localStorage.setItem(KEY, JSON.stringify(workspaces));
}

export function addOrUpdateWorkspace(ws: Workspace): Workspace[] {
    const all = loadWorkspaces();
    const idx = all.findIndex(w => w.id === ws.id);
    if (idx >= 0) {
        all[idx] = ws;
    } else {
        all.unshift(ws);
    }
    saveWorkspaces(all);
    return all;
}

export function patchWorkspace(id: string, patch: Partial<Workspace>): Workspace[] {
    const all = loadWorkspaces();
    const idx = all.findIndex(w => w.id === id);
    if (idx >= 0) {
        all[idx] = { ...all[idx], ...patch };
        saveWorkspaces(all);
    }
    return all;
}

export function removeWorkspace(id: string): Workspace[] {
    const all = loadWorkspaces().filter(w => w.id !== id);
    saveWorkspaces(all);
    return all;
}

export function getActiveWorkspaceId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveWorkspaceId(id: string): void {
    localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveWorkspace(): Workspace | null {
    const id = getActiveWorkspaceId();
    if (!id) return null;
    return loadWorkspaces().find(w => w.id === id) ?? null;
}
