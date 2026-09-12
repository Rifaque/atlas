import { useCallback, useEffect, useState } from 'react';
import {
    fetchIndexHealth,
    getIndexJob,
    listenIndexProgress,
    startIndexing,
    startWatcher,
    stopWatcher,
    type IndexHealth,
} from '../../lib/api';

export function useWorkspaceIndex(workspaceId: string, embeddingModel: string, ollamaHost: string) {
    const [health, setHealth] = useState<IndexHealth | null>(null);

    const refreshHealth = useCallback(async () => {
        setHealth(await fetchIndexHealth(workspaceId));
    }, [workspaceId]);

    useEffect(() => {
        let cancelled = false;
        void fetchIndexHealth(workspaceId).then(next => {
            if (!cancelled) setHealth(next);
        });
        void startWatcher(workspaceId, embeddingModel, ollamaHost);
        const interval = window.setInterval(() => {
            void fetchIndexHealth(workspaceId).then(next => {
                if (!cancelled) setHealth(next);
            });
        }, 5000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            void stopWatcher(workspaceId);
        };
    }, [workspaceId, embeddingModel, ollamaHost]);

    const refreshIndex = useCallback(async () => {
        const jobId = await startIndexing(workspaceId, embeddingModel, ollamaHost);
        setHealth(current => ({
            status: 'queued',
            fileCount: current?.fileCount ?? 0,
            chunkCount: current?.chunkCount ?? 0,
            embeddingModel,
            lastCompletedAt: current?.lastCompletedAt ?? null,
            error: null,
        }));
        let unlisten: () => void = () => undefined;
        unlisten = await listenIndexProgress(jobId, async progress => {
            if (progress.status === 'completed' || progress.status === 'failed') {
                unlisten();
                await refreshHealth();
            } else {
                setHealth(current => current ? { ...current, status: 'running' } : current);
            }
        });
        const job = await getIndexJob(jobId);
        if (job.status === 'completed' || job.status === 'failed') {
            unlisten();
            await refreshHealth();
        }
    }, [workspaceId, embeddingModel, ollamaHost, refreshHealth]);

    return { health, refreshHealth, refreshIndex };
}
