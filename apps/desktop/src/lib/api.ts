import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { EvidenceRef } from './chats';

// ─── Models & Status ────────────────────────────────────────────────────────

export async function fetchModels(ollamaHost?: string): Promise<string[]> {
    try {
        return await invoke<string[]>('list_models', { ollamaHost: ollamaHost || null });
    } catch {
        return [];
    }
}

export async function checkOllamaStatus(ollamaHost?: string): Promise<string> {
    try {
        return await invoke<string>('check_status', { ollamaHost: ollamaHost || null });
    } catch {
        return 'offline';
    }
}

// ─── Indexing ────────────────────────────────────────────────────────────────

export async function selectWorkspace(): Promise<string | null> {
    return invoke<string | null>('select_workspace');
}

export async function isWorkspaceAuthorized(folderPath: string): Promise<boolean> {
    return invoke<boolean>('is_workspace_authorized', { folderPath });
}

export async function startIndexing(folderPath: string, model: string, ollamaHost?: string): Promise<string> {
    return await invoke<string>('start_indexing', { folderPath, model, ollamaHost: ollamaHost || null });
}

export async function startWatcher(folderPath: string, model: string, ollamaHost?: string): Promise<void> {
    await invoke('start_watcher', { folderPath, model, ollamaHost: ollamaHost || null });
}

export async function stopWatcher(folderPath: string): Promise<void> {
    await invoke('stop_watcher', { folderPath });
}

export interface IndexProgress {
    status: string;
    processedFiles?: number;
    totalFiles?: number;
    totalChunks?: number;
    error?: string;
    recoveryMessage?: string;
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

export interface IndexHealth {
    status: 'not_indexed' | 'queued' | 'running' | 'ready' | 'failed' | 'incompatible';
    fileCount: number;
    chunkCount: number;
    embeddingModel: string | null;
    lastCompletedAt: number | null;
    error: string | null;
}

export async function fetchIndexHealth(workspaceId: string): Promise<IndexHealth> {
    return invoke<IndexHealth>('get_index_health', { workspaceId });
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatStreamEvent =
    | { type: 'chunk'; data?: { chunk?: string } }
    | { type: 'citations'; data?: EvidenceRef[] }
    | { type: 'suggestions'; data?: { suggestions?: string[] } }
    | { type: 'error'; data?: { error?: string; code?: string } }
    | { type: 'done'; data?: undefined };

export interface ChatRequest {
    query: string;
    model: string;
    provider?: string;
    ollamaHost?: string;
    manualFiles?: string[];
    systemPrompt?: string;
    folderPath?: string;
    history?: { role: string; content: string }[];
    /** The model used for indexing — used for query embedding to match vector dimensions */
    embeddingModel?: string;
    allowCloud?: boolean;
}

/** Start a chat and return the event ID + unlisten function. */
export async function startChat(
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
    onReady?: (eventId: string, unlisten: UnlistenFn) => void,
): Promise<{ eventId: string; unlisten: UnlistenFn }> {
    const eventId = `chat-stream-${crypto.randomUUID()}`;

    const unlisten = await listen<ChatStreamEvent>(eventId, (event) => {
        onEvent(event.payload);
    });

    // Expose the listener before invoking Rust because a local shortcut may emit
    // and finish before the invoke promise resolves.
    onReady?.(eventId, unlisten);
    await invoke('start_chat', { eventId, request });

    return { eventId, unlisten };
}

export async function stopChat(eventId: string): Promise<void> {
    await invoke('stop_chat', { eventId });
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface EvidenceResult extends EvidenceRef {
    content: string;
    sourceType: 'workspace_file' | 'pinned_workspace_file';
}

export interface SearchResult extends EvidenceResult {
    filePath: string;
    snippet: string;
}

export async function searchFiles(query: string, model: string, folderPath: string, ollamaHost?: string): Promise<SearchResult[]> {
    return invoke<SearchResult[]>('search_files', {
        query,
        model,
        folderPath,
        ollamaHost: ollamaHost || null,
    });
}

// ─── File Operations ─────────────────────────────────────────────────────────

export async function getIndexJob(jobId: string): Promise<IndexProgress> {
    const job = await invoke<{ status: string; processed_files: number; total_files: number; total_chunks: number; error?: string }>('get_index_job', { jobId });
    return {
        status: job.status,
        processedFiles: job.processed_files,
        totalFiles: job.total_files,
        totalChunks: job.total_chunks,
        error: job.error,
    };
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

export interface FileContent {
    content: string;
    totalLines: number;
}

export async function fetchFileContent(workspacePath: string, filePath: string): Promise<FileContent> {
    return invoke<FileContent>('read_file', {
        filePath,
        workspacePath,
        start: null,
        end: null,
    });
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
