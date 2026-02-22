import { ChromaClient, Collection } from 'chromadb';

export interface StoredChunkMetadata {
    filePath: string;
    chunkIndex: number;
    lineRangeStart: number;
    lineRangeEnd: number;
    /** The wider parent window (≈1500 tokens) that the LLM reads. May equal the child text. */
    parentText?: string;
    parentLineRangeStart?: number;
    parentLineRangeEnd?: number;
}

export class AtlasVectorStore {
    private client: ChromaClient;
    private collectionName = 'atlas_workspace';

    constructor(host = 'http://127.0.0.1:8000') {
        this.client = new ChromaClient({ path: host });
    }

    async getCollection(): Promise<Collection> {
        return await this.client.getOrCreateCollection({
            name: this.collectionName,
            metadata: { 'hnsw:space': 'cosine' },
        });
    }

    /** Upsert child-chunk embeddings along with their metadata. */
    async storeChunks(
        ids: string[],
        embeddings: number[][],
        metadatas: StoredChunkMetadata[],
        documents: string[], // child text — embedded
    ): Promise<void> {
        const collection = await this.getCollection();

        // ChromaDB metadata values must be strings, numbers, or booleans.
        // parentText can be large — store it on the metadata object directly
        // (ChromaDB supports long strings; typical parent is ≈6 kB, well within limits)
        await collection.upsert({ ids, embeddings, metadatas: metadatas as any[], documents });
    }

    /** Semantic similarity search — returns top-n results in ChromaDB shape. */
    async similaritySearch(
        queryEmbedding: number[],
        nResults: number = 20,
        where?: Record<string, any>,
    ) {
        const collection = await this.getCollection();
        return await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults,
            where,
        });
    }

    /** Delete all chunks belonging to a specific file. Used during incremental re-indexing. */
    async deleteByFilePath(filePath: string): Promise<void> {
        try {
            const collection = await this.getCollection();
            await collection.delete({ where: { filePath } });
        } catch { /* ignore if collection doesn't exist yet or filter fails */ }
    }
}

// Re-export the reranker so consumers only need to import from @atlas/retrieval
export { rerank, bm25Scores, crossEncoderScore } from './reranker';
export type { RerankerDoc } from './reranker';
