export const WORKSPACE_SCHEMA_VERSION = 2;

export interface Workspace {
    /** Canonical backend-authorized root path. */
    id: string;
    name: string;
    folderPath: string;
    embeddingModel: string;
    indexedAt: number;
    lastOpened?: number;
    lastIndexStatus?: 'not_indexed' | 'ready' | 'failed';
}

interface WorkspaceEnvelope {
    version: typeof WORKSPACE_SCHEMA_VERSION;
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
}

const KEY = 'atlas_workspaces_v2';
const LEGACY_KEY = 'atlas_workspaces';
const LEGACY_ACTIVE_KEYS = ['atlas_active_workspaces', 'atlas_active_workspace'];

function isWorkspace(value: unknown): value is Workspace {
    if (!value || typeof value !== 'object') return false;
    const workspace = value as Partial<Workspace>;
    return typeof workspace.folderPath === 'string'
        && typeof workspace.name === 'string'
        && typeof workspace.embeddingModel === 'string'
        && typeof workspace.indexedAt === 'number';
}

function migrateLegacy(): WorkspaceEnvelope {
    let legacy: unknown = [];
    try {
        legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]');
    } catch {
        legacy = [];
    }
    const workspaces = Array.isArray(legacy)
        ? legacy.flatMap((value): Workspace[] => {
            if (!value || typeof value !== 'object') return [];
            const old = value as Record<string, unknown>;
            if (typeof old.folderPath !== 'string' || typeof old.name !== 'string') return [];
            const embeddingModel = typeof old.embeddingModel === 'string'
                ? old.embeddingModel
                : typeof old.model === 'string' ? old.model : '';
            if (!embeddingModel) return [];
            return [{
                id: old.folderPath,
                name: old.name,
                folderPath: old.folderPath,
                embeddingModel,
                indexedAt: typeof old.indexedAt === 'number' ? old.indexedAt : 0,
                lastOpened: typeof old.lastOpened === 'number' ? old.lastOpened : undefined,
                lastIndexStatus: old.indexedAt ? 'ready' : 'not_indexed',
            }];
        })
        : [];

    let activeWorkspaceId: string | null = null;
    for (const key of LEGACY_ACTIVE_KEYS) {
        try {
            const value = JSON.parse(localStorage.getItem(key) ?? 'null');
            const oldId = Array.isArray(value) ? value[0] : value;
            const legacyWorkspace = Array.isArray(legacy)
                ? legacy.find(item => item && typeof item === 'object' && (item as Record<string, unknown>).id === oldId) as Record<string, unknown> | undefined
                : undefined;
            const legacyPath = typeof legacyWorkspace?.folderPath === 'string' ? legacyWorkspace.folderPath : oldId;
            const match = workspaces.find(workspace => workspace.id === legacyPath);
            if (match) {
                activeWorkspaceId = match.id;
                break;
            }
        } catch {
            // Ignore malformed legacy active-workspace state.
        }
    }
    return { version: WORKSPACE_SCHEMA_VERSION, workspaces, activeWorkspaceId };
}

function loadEnvelope(): WorkspaceEnvelope {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<WorkspaceEnvelope> | null;
        if (value?.version === WORKSPACE_SCHEMA_VERSION && Array.isArray(value.workspaces)) {
            return {
                version: WORKSPACE_SCHEMA_VERSION,
                workspaces: value.workspaces.filter(isWorkspace),
                activeWorkspaceId: typeof value.activeWorkspaceId === 'string' ? value.activeWorkspaceId : null,
            };
        }
    } catch {
        // Preserve malformed storage and recover with a validated migration/default.
    }
    const migrated = migrateLegacy();
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
}

function saveEnvelope(envelope: WorkspaceEnvelope): void {
    localStorage.setItem(KEY, JSON.stringify(envelope));
}

export function loadWorkspaces(): Workspace[] {
    return loadEnvelope().workspaces.sort((a, b) => (b.lastOpened ?? b.indexedAt) - (a.lastOpened ?? a.indexedAt));
}

export function addOrUpdateWorkspace(workspace: Workspace): Workspace[] {
    const envelope = loadEnvelope();
    const canonical = { ...workspace, id: workspace.folderPath };
    const index = envelope.workspaces.findIndex(item => item.id === canonical.id);
    if (index >= 0) envelope.workspaces[index] = canonical;
    else envelope.workspaces.unshift(canonical);
    envelope.activeWorkspaceId = canonical.id;
    saveEnvelope(envelope);
    return envelope.workspaces;
}

export function patchWorkspace(id: string, patch: Partial<Workspace>): Workspace[] {
    const envelope = loadEnvelope();
    const index = envelope.workspaces.findIndex(workspace => workspace.id === id);
    if (index >= 0) {
        envelope.workspaces[index] = { ...envelope.workspaces[index], ...patch, id: envelope.workspaces[index].folderPath };
        saveEnvelope(envelope);
    }
    return envelope.workspaces;
}

/** Removes only the launcher registration. Local index/history data is retained. */
export function removeWorkspace(id: string): Workspace[] {
    const envelope = loadEnvelope();
    envelope.workspaces = envelope.workspaces.filter(workspace => workspace.id !== id);
    if (envelope.activeWorkspaceId === id) envelope.activeWorkspaceId = null;
    saveEnvelope(envelope);
    return envelope.workspaces;
}

export function setActiveWorkspace(id: string | null): void {
    const envelope = loadEnvelope();
    envelope.activeWorkspaceId = id;
    saveEnvelope(envelope);
}

export function getActiveWorkspace(): Workspace | null {
    const envelope = loadEnvelope();
    return envelope.workspaces.find(workspace => workspace.id === envelope.activeWorkspaceId) ?? null;
}
