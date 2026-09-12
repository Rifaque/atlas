export const HISTORY_SCHEMA_VERSION = 2;

export interface EvidenceRef {
    id: string;
    workspaceId: string;
    filePath: string;
    displayPath: string;
    lineStart: number;
    lineEnd: number;
    snippet: string;
    sourceType: 'workspace_file' | 'pinned_workspace_file';
    /** Provenance supplied by the backend for answer-generation discipline. */
    sourceKind?: 'implementation_code' | 'documentation' | 'design_specification' | 'test' | 'fixture' | 'configuration' | 'historical_audit' | 'other';
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    evidence?: EvidenceRef[];
    followUpSuggestions?: string[];
    status?: 'streaming' | 'complete' | 'stopped' | 'failed';
    error?: string;
}

export interface ChatSession {
    id: string;
    workspaceId: string;
    title: string;
    updatedAt: number;
    messages: ChatMessage[];
    manualContext: string[];
}

interface HistoryEnvelope {
    version: typeof HISTORY_SCHEMA_VERSION;
    workspaces: Record<string, ChatSession[]>;
    activeSessionIds: Record<string, string>;
}

const KEY = 'atlas_history_v2';
const LEGACY_KEY = 'atlas_chats';

function validMessage(value: unknown): value is ChatMessage {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<ChatMessage>;
    return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string';
}

function validSession(value: unknown, workspaceId: string): value is ChatSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as Partial<ChatSession>;
    return session.workspaceId === workspaceId
        && typeof session.id === 'string'
        && typeof session.title === 'string'
        && typeof session.updatedAt === 'number'
        && Array.isArray(session.messages)
        && session.messages.every(validMessage);
}

function emptyEnvelope(): HistoryEnvelope {
    return { version: HISTORY_SCHEMA_VERSION, workspaces: {}, activeSessionIds: {} };
}

function legacyActiveWorkspaceId(): string | null {
    try {
        const current = JSON.parse(localStorage.getItem('atlas_workspaces_v2') ?? 'null') as { activeWorkspaceId?: unknown } | null;
        if (typeof current?.activeWorkspaceId === 'string') return current.activeWorkspaceId;
        const workspaces = JSON.parse(localStorage.getItem('atlas_workspaces') ?? '[]') as Array<Record<string, unknown>>;
        const active = JSON.parse(localStorage.getItem('atlas_active_workspaces') ?? localStorage.getItem('atlas_active_workspace') ?? 'null');
        const oldId = Array.isArray(active) ? active[0] : active;
        const match = workspaces.find(workspace => workspace.id === oldId);
        return typeof match?.folderPath === 'string' ? match.folderPath : null;
    } catch {
        return null;
    }
}

function migrateLegacy(): HistoryEnvelope {
    const envelope = emptyEnvelope();
    try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]') as unknown;
        if (!Array.isArray(legacy)) return envelope;
        const fallbackWorkspaceId = legacyActiveWorkspaceId();
        for (const value of legacy) {
            if (!value || typeof value !== 'object') continue;
            const old = value as Record<string, unknown>;
            const workspaceId = typeof old.workspaceId === 'string' ? old.workspaceId : fallbackWorkspaceId;
            if (!workspaceId || typeof old.id !== 'string') continue;
            const messages = Array.isArray(old.messages) ? old.messages.filter(validMessage) : [];
            const session: ChatSession = {
                id: old.id,
                workspaceId,
                title: typeof old.title === 'string' ? old.title : 'Recovered Chat',
                updatedAt: typeof old.updatedAt === 'number' ? old.updatedAt : 0,
                messages,
                manualContext: Array.isArray(old.manualContext)
                    ? old.manualContext.filter((path): path is string => typeof path === 'string')
                    : [],
            };
            (envelope.workspaces[session.workspaceId] ??= []).push(session);
            envelope.activeSessionIds[session.workspaceId] ??= session.id;
        }
    } catch {
        // Leave corrupt legacy state untouched and start with an empty valid envelope.
    }
    localStorage.setItem(KEY, JSON.stringify(envelope));
    return envelope;
}

function loadEnvelope(): HistoryEnvelope {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<HistoryEnvelope> | null;
        if (parsed?.version === HISTORY_SCHEMA_VERSION && parsed.workspaces && typeof parsed.workspaces === 'object') {
            const envelope = emptyEnvelope();
            for (const [workspaceId, sessions] of Object.entries(parsed.workspaces)) {
                if (!Array.isArray(sessions)) continue;
                envelope.workspaces[workspaceId] = sessions
                    .filter(session => validSession(session, workspaceId))
                    .map(session => ({ ...session, manualContext: Array.isArray(session.manualContext) ? session.manualContext : [] }));
                const activeId = parsed.activeSessionIds?.[workspaceId];
                if (typeof activeId === 'string' && envelope.workspaces[workspaceId].some(session => session.id === activeId)) {
                    envelope.activeSessionIds[workspaceId] = activeId;
                }
            }
            return envelope;
        }
    } catch {
        // Preserve malformed current storage; callers receive recovered legacy/empty state.
    }
    return migrateLegacy();
}

function saveEnvelope(envelope: HistoryEnvelope): void {
    localStorage.setItem(KEY, JSON.stringify(envelope));
}

export async function loadChats(workspaceId: string): Promise<ChatSession[]> {
    return [...(loadEnvelope().workspaces[workspaceId] ?? [])]
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadActiveChatId(workspaceId: string): string | null {
    return loadEnvelope().activeSessionIds[workspaceId] ?? null;
}

export function setActiveChatId(workspaceId: string, sessionId: string): void {
    const envelope = loadEnvelope();
    if ((envelope.workspaces[workspaceId] ?? []).some(session => session.id === sessionId)) {
        envelope.activeSessionIds[workspaceId] = sessionId;
        saveEnvelope(envelope);
    }
}

export async function saveChat(chat: ChatSession): Promise<void> {
    if (!chat.workspaceId) throw new Error('Chat session requires a workspace identity');
    const envelope = loadEnvelope();
    const sessions = [...(envelope.workspaces[chat.workspaceId] ?? [])];
    const next = { ...chat, manualContext: [...chat.manualContext], updatedAt: Date.now() };
    if (!next.title || next.title === 'New Chat') {
        const firstUser = next.messages.find(message => message.role === 'user');
        if (firstUser) next.title = `${firstUser.content.slice(0, 30)}${firstUser.content.length > 30 ? '…' : ''}`;
    }
    const index = sessions.findIndex(session => session.id === next.id);
    if (index >= 0) sessions[index] = next;
    else sessions.push(next);
    envelope.workspaces[chat.workspaceId] = sessions
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50);
    envelope.activeSessionIds[chat.workspaceId] = next.id;
    saveEnvelope(envelope);
}

export async function deleteChat(id: string, workspaceId: string): Promise<void> {
    const envelope = loadEnvelope();
    envelope.workspaces[workspaceId] = (envelope.workspaces[workspaceId] ?? [])
        .filter(session => session.id !== id);
    if (envelope.activeSessionIds[workspaceId] === id) {
        const replacement = envelope.workspaces[workspaceId][0]?.id;
        if (replacement) envelope.activeSessionIds[workspaceId] = replacement;
        else delete envelope.activeSessionIds[workspaceId];
    }
    saveEnvelope(envelope);
}

export async function renameChat(chat: ChatSession, title: string): Promise<void> {
    await saveChat({ ...chat, title });
}

export function createNewChat(workspaceId: string): ChatSession {
    return {
        id: crypto.randomUUID(),
        workspaceId,
        title: 'New Chat',
        updatedAt: Date.now(),
        messages: [],
        manualContext: [],
    };
}
