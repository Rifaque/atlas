import { useCallback, useEffect, useState } from 'react';
import { fetchFileTree, searchFiles, type FileNode, type SearchResult } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';

export function useWorkspaceEvidence(workspaceId: string, embeddingModel: string, ollamaHost: string) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tree, setTree] = useState<FileNode[]>([]);

    useEffect(() => {
        let active = true;
        fetchFileTree(workspaceId).then(value => { if (active) setTree(value); });
        return () => { active = false; };
    }, [workspaceId]);

    const find = useCallback(async () => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        setError(null);
        try {
            setResults(await searchFiles(query, embeddingModel, workspaceId, ollamaHost));
        } catch (cause) {
            setError(getErrorMessage(cause, 'Search failed'));
        } finally {
            setSearching(false);
        }
    }, [query, embeddingModel, workspaceId, ollamaHost]);

    return { query, setQuery, results, searching, error, find, tree };
}
