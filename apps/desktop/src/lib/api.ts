const API_BASE_URL = 'http://127.0.0.1:47291/api';

export async function fetchModels(): Promise<string[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/models`);
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        return data.models;
    } catch {
        return [];
    }
}

export async function fetchOpenRouterModels(apiKey?: string): Promise<{ free: string[]; paid: string[] }> {
    try {
        const url = apiKey ? `${API_BASE_URL}/openrouter-models?apiKey=${encodeURIComponent(apiKey)}` : `${API_BASE_URL}/openrouter-models`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch OpenRouter models');
        return await response.json();
    } catch {
        return { free: [], paid: [] };
    }
}

export async function checkOllamaStatus(): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (!response.ok) throw new Error('Failed to fetch status');
        const data = await response.json();
        return data.status;
    } catch {
        return 'offline';
    }
}

export async function startIndexing(folderPath: string, model: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, model })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to start indexing');
    }
    const data = await response.json();
    return data.jobId;
}

export async function fetchIndexStats(): Promise<{ count: number }> {
    try {
        const response = await fetch(`${API_BASE_URL}/index-stats`);
        if (!response.ok) return { count: 0 };
        return response.json();
    } catch {
        return { count: 0 };
    }
}

export interface SearchResult {
    filePath: string;
    snippet: string;
    lineRangeStart?: number;
}

export async function searchFiles(query: string, model: string, folderPath?: string): Promise<SearchResult[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, model, folderPath })
        });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        return data.files || [];
    } catch {
        return [];
    }
}

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: FileNode[];
}

export async function fetchFileTree(folderPath: string): Promise<FileNode[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/files?folderPath=${encodeURIComponent(folderPath)}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.tree || [];
    } catch {
        return [];
    }
}

export async function fetchFileContent(filePath: string): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/file/content?filePath=${encodeURIComponent(filePath)}`);
        if (!response.ok) return '';
        const data = await response.json();
        return data.content || '';
    } catch {
        return '';
    }
}

export async function fetchOllamaStatus(host = 'http://127.0.0.1:11434'): Promise<boolean> {
    try {
        const res = await fetch(host);
        return res.ok;
    } catch {
        return false;
    }
}
