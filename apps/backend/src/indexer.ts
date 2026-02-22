import { crawlDirectory } from './crawler';
import { chunkTextParentChild } from '@atlas/chunking';
import { generateEmbeddings } from '@atlas/embeddings';
import { AtlasVectorStore, type StoredChunkMetadata } from '@atlas/retrieval';
import { randomUUID } from 'crypto';
import { loadManifest, saveManifest, needsIndexing, markIndexed, removeFromManifest } from './manifest';

export interface IndexingJob {
    id: string;
    folderPath: string;
    status: 'running' | 'completed' | 'failed';
    processedFiles: number;
    totalChunks: number;
    error?: string;
    model: string;
}

export const jobs = new Map<string, IndexingJob>();
export const jobSubscribers = new Map<string, Set<(job: IndexingJob) => void>>();

export function subscribeToJob(id: string, cb: (job: IndexingJob) => void) {
    if (!jobSubscribers.has(id)) jobSubscribers.set(id, new Set());
    jobSubscribers.get(id)!.add(cb);
    return () => { jobSubscribers.get(id)?.delete(cb); };
}

function updateJob(id: string, patch: Partial<IndexingJob>) {
    const job = jobs.get(id);
    if (!job) return;
    Object.assign(job, patch);
    const subs = jobSubscribers.get(id);
    if (subs) {
        for (const sub of subs) {
            try { sub({ ...job }); } catch { /* ignore subscriber errors */ }
        }
    }
}

export async function startIndexing(folderPath: string, model: string): Promise<string> {
    const id = randomUUID();
    jobs.set(id, { id, folderPath, status: 'running', processedFiles: 0, totalChunks: 0, model });

    runIndexingJob(id).catch(err => {
        console.error('[indexer] Job failed:', id, err);
        updateJob(id, { status: 'failed', error: err.message });
    });

    return id;
}

// ─── Parent text truncation ───────────────────────────────────────────────────
// ChromaDB has a practical metadata size limit (~64 kB per item).
// A parent chunk at 6000 chars is safe, but clip as a safeguard.
const MAX_PARENT_CHARS = 8000;

async function runIndexingJob(id: string) {
    const job = jobs.get(id)!;
    const store = new AtlasVectorStore();

    // Load manifest for incremental indexing
    const manifest = loadManifest(job.folderPath);
    const seenFiles = new Set<string>();

    interface BatchItem { childText: string; meta: StoredChunkMetadata; }
    let buffer: BatchItem[] = [];
    const BATCH_SIZE = 8;

    async function flushBuffer() {
        if (buffer.length === 0) return;
        const texts = buffer.map(b => b.childText);
        const embeddings = await generateEmbeddings(texts, { model: 'nomic-embed-text' });
        const ids = buffer.map(() => randomUUID());
        await store.storeChunks(ids, embeddings, buffer.map(b => b.meta), texts);
        updateJob(id, { totalChunks: job.totalChunks + buffer.length });
        buffer = [];
    }

    await crawlDirectory(job.folderPath, async (file) => {
        seenFiles.add(file.filePath);

        if (!needsIndexing(manifest, file.filePath)) {
            // Already indexed and unmodified
            updateJob(id, { processedFiles: job.processedFiles + 1 });
            return;
        }

        // Delete previous chunks for this file if we are re-indexing it
        await store.deleteByFilePath(file.filePath);

        const pairs = chunkTextParentChild(file.content, file.filePath);
        for (const pair of pairs) {
            const meta: StoredChunkMetadata = {
                filePath: pair.child.metadata.filePath,
                chunkIndex: pair.child.metadata.chunkIndex,
                lineRangeStart: pair.child.metadata.lineRange[0],
                lineRangeEnd: pair.child.metadata.lineRange[1],
                parentText: pair.parentText.slice(0, MAX_PARENT_CHARS),
                parentLineRangeStart: pair.parentLineRange[0],
                parentLineRangeEnd: pair.parentLineRange[1],
            };
            buffer.push({ childText: pair.child.text, meta });
            if (buffer.length >= BATCH_SIZE) await flushBuffer();
        }

        markIndexed(manifest, file.filePath, pairs.length);
        updateJob(id, { processedFiles: job.processedFiles + 1 });
    });

    await flushBuffer();

    // Sweep phase: delete chunks for files that no longer exist
    for (const filePath of Object.keys(manifest)) {
        if (!seenFiles.has(filePath)) {
            await store.deleteByFilePath(filePath);
            removeFromManifest(manifest, filePath);
        }
    }

    saveManifest(job.folderPath, manifest);
    updateJob(id, { status: 'completed' });
}
