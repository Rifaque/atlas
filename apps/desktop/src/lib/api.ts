import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';

// ─── Models & Status ────────────────────────────────────────────────────────

export async function fetchModels(): Promise<string[]> {
    try {
        return await invoke<string[]>('list_models', {});
    } catch {
        return [];
    }
}

export async function fetchOpenRouterModels(apiKey?: string): Promise<{ free: string[]; paid: string[] }> {
    try {
        const data = await invoke<{ free: { id: string }[]; paid: { id: string }[] }>(
            'list_openrouter_models',
            { apiKey: apiKey || null }
        );
        return {
            free: data.free.map((m: { id: string }) => m.id),
            paid: data.paid.map((m: { id: string }) => m.id),
        };
    } catch {
        return { free: [], paid: [] };
    }
}

export async function checkOllamaStatus(): Promise<string> {
    try {
        return await invoke<string>('check_status', {});
    } catch {
        return 'offline';
    }
}

// ─── Indexing ────────────────────────────────────────────────────────────────

export async function startIndexing(folderPath: string, model: string): Promise<string> {
    return await invoke<string>('start_indexing', { folderPath, model });
}

export async function startWatcher(folderPath: string, model: string): Promise<void> {
    await invoke('start_watcher', { folderPath, model });
}

export async function stopWatcher(folderPath: string): Promise<void> {
    await invoke('stop_watcher', { folderPath });
}

export interface IndexProgress {
    status: string;
    processedFiles?: number;
    totalChunks?: number;
    error?: string;
}

/** Listen for index progress events. Returns an unlisten function. */
export async function listenIndexProgress(
    jobId: string,
    onProgress: (data: IndexProgress) => void,
): Promise<UnlistenFn> {
    return listen<IndexProgress>(`index-progress-${jobId}`, (event) => {
        onProgress(event.payload);
    });
}

export interface WorkspaceStats {
    total_chunks: number;
    total_files: number;
    knowledge_coverage: number;
    language_distribution: Record<string, number>;
}

export async function fetchIndexStats(workspaceId: string): Promise<WorkspaceStats> {
    try {
        return await invoke<WorkspaceStats>('get_index_stats', { workspaceId });
    } catch {
        return { total_chunks: 0, total_files: 0, knowledge_coverage: 0, language_distribution: {} };
    }
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatStreamEvent {
    type: 'chunk' | 'citations' | 'suggestions' | 'error' | 'done';
    data?: any;
}

export interface ChatRequest {
    query: string;
    model: string;
    provider?: string;
    apiKey?: string;
    ollamaHost?: string;
    manualFiles?: string[];
    systemPrompt?: string;
    folderPath?: string;
    history?: { role: string; content: string }[];
    /** The model used for indexing — used for query embedding to match vector dimensions */
    embeddingModel?: string;
    /** Active persona ID (e.g. "architect", "security-auditor") */
    persona?: string;
    /** Web search: enrich context with web results */
    webSearchEnabled?: boolean;
    /** Web search: API key for the provider */
    webSearchApiKey?: string;
    /** Web search: provider name ("tavily" or "serper") */
    webSearchProvider?: string;
    /** Vision: Attach images as base64 encoded strings */
    images?: string[];
    /** GraphRAG: Search across multiple workspace IDs */
    workspaceIds?: string[];
}

/** Start a chat and return the event ID + unlisten function. */
export async function startChat(
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
): Promise<{ eventId: string; unlisten: UnlistenFn }> {
    const eventId = `chat-stream-${uuidv4()}`;

    const unlisten = await listen<ChatStreamEvent>(eventId, (event) => {
        onEvent(event.payload);
    });

    await invoke('start_chat', { eventId, request });

    return { eventId, unlisten };
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
    filePath: string;
    snippet: string;
    lineRangeStart?: number;
}

export async function searchFiles(query: string, model: string, folderPath?: string, workspaceIds?: string[]): Promise<SearchResult[]> {
    try {
        return await invoke<SearchResult[]>('search_files', {
            query,
            model,
            folderPath: folderPath || null,
            workspaceIds: workspaceIds || null,
        });
    } catch {
        return [];
    }
}

// ─── File Operations ─────────────────────────────────────────────────────────

export async function executeShellCommand(cmd: string, args: string[], cwd?: string): Promise<{ stdout: string, stderr: string, code: number }> {
    try {
        return await invoke('execute_shell_command', { cmd, args, cwd });
    } catch (e: any) {
        throw new Error(e);
    }
}

export async function applyDiff(filepath: string, originalContent: string, newContent: string): Promise<void> {
    try {
        await invoke('apply_diff', { filepath, originalContent, newContent });
    } catch (e: any) {
        throw new Error(e);
    }
}

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileNode[];
}

export async function fetchFileTree(folderPath: string): Promise<FileNode[]> {
    try {
        return await invoke<FileNode[]>('get_file_tree', { folderPath });
    } catch {
        return [];
    }
}

export async function fetchFileContent(filePath: string): Promise<string> {
    try {
        const data = await invoke<{ content: string; totalLines: number }>('read_file', {
            filePath,
            start: null,
            end: null,
        });
        return data.content || '';
    } catch {
        return '';
    }
}

// ─── Secret Shield ───────────────────────────────────────────────────────────

export interface SecretMatch {
    kind: string;
    preview: string;
    offset: number;
}

export async function scanSecrets(text: string): Promise<SecretMatch[]> {
    try {
        return await invoke<SecretMatch[]>('scan_secrets', { text });
    } catch {
        return [];
    }
}

// ─── Timeline Intelligence ────────────────────────────────────────────────────────

export interface TimelineEvent {
    file_path: string;
    relative_path: string;
    mtime: number;
    change_type: string;
    current_content: string | null;
}

/** Fetch timeline events for the workspace folder within the past `hours` hours. */
export async function fetchTimeline(folderPath: string, hours: number): Promise<TimelineEvent[]> {
    try {
        return await invoke<TimelineEvent[]>('get_timeline', { folderPath, hours });
    } catch {
        return [];
    }
}

// ─── Git Awareness ────────────────────────────────────────────────────────────

export interface GitContext {
    branch: string;
    uncommitted_files: string[];
    recent_commits: string[];
    diff_summary: string;
}

export async function fetchGitContext(folderPath: string): Promise<GitContext | null> {
    try {
        return await invoke<GitContext>('get_git_context', { folderPath });
    } catch {
        return null;
    }
}



// ─── Legacy compatibility ────────────────────────────────────────────────────
// These map to the old function names used by some components

export async function fetchOllamaStatus(): Promise<boolean> {
    const status = await checkOllamaStatus();
    return status === 'online';
}
