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

export async function fetchIndexStats(): Promise<{ count: number }> {
    try {
        return await invoke<{ count: number }>('get_index_stats', {});
    } catch {
        return { count: 0 };
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

export async function searchFiles(query: string, model: string, folderPath?: string): Promise<SearchResult[]> {
    try {
        return await invoke<SearchResult[]>('search_files', {
            query,
            model,
            folderPath: folderPath || null,
        });
    } catch {
        return [];
    }
}

// ─── File Operations ─────────────────────────────────────────────────────────

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

// ─── Legacy compatibility ────────────────────────────────────────────────────
// These map to the old function names used by some components

export async function fetchOllamaStatus(): Promise<boolean> {
    const status = await checkOllamaStatus();
    return status === 'online';
}
