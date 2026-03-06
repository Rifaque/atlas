export interface Workspace {
    id: string;
    name: string;
    folderPath: string;
    model: string;
    indexedAt: number;
    displayName?: string;
    icon?: string;
    lastOpened?: number;
    stats?: { files: number; chunks: number };
}

const KEY = 'atlas_workspaces';
const ACTIVE_KEY = 'atlas_active_workspaces';

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

export function getActiveWorkspaceIds(): string[] {
    try {
        const raw = localStorage.getItem(ACTIVE_KEY);
        if (raw) return JSON.parse(raw);

        // Migration: check legacy single workspace key
        const legacy = localStorage.getItem('atlas_active_workspace');
        if (legacy) {
            const ids = [legacy];
            setActiveWorkspaceIds(ids);
            localStorage.removeItem('atlas_active_workspace');
            return ids;
        }
        return [];
    } catch {
        return [];
    }
}

export function setActiveWorkspaceIds(ids: string[]): void {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids));
}

export function toggleActiveWorkspaceId(id: string): string[] {
    const active = getActiveWorkspaceIds();
    const idx = active.indexOf(id);
    if (idx >= 0) {
        active.splice(idx, 1);
    } else {
        active.push(id);
    }
    setActiveWorkspaceIds(active);
    return active;
}

export function getActiveWorkspaces(): Workspace[] {
    const ids = getActiveWorkspaceIds();
    const all = loadWorkspaces();
    return all.filter(w => ids.includes(w.id));
}
