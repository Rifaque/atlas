import * as lancedb from '@lancedb/lancedb';
import { Schema, Field, Float32, Utf8, Int32, FixedSizeList } from 'apache-arrow';
import os from 'os';
import path from 'path';
import fs from 'fs';

// types

export interface StoredChunkMetadata {
    filePath: string;
    chunkIndex: number;
    lineRangeStart: number;
    lineRangeEnd: number;
    parentText?: string;
    parentLineRangeStart?: number;
    parentLineRangeEnd?: number;
}

interface LanceRow {
    id: string;
    vector: number[];
    document: string;        // child text (embedded)
    filePath: string;
    chunkIndex: number;
    lineRangeStart: number;
    lineRangeEnd: number;
    parentText: string;
    parentLineRangeStart: number;
    parentLineRangeEnd: number;
}

// the actual vector db logic using lancedb


const TABLE_NAME = 'atlas_workspace';

export class AtlasVectorStore {
    private dbPath: string;
    private db: lancedb.Connection | null = null;
    private table: lancedb.Table | null = null;

    constructor(dbPath?: string) {
        this.dbPath = dbPath ?? path.join(os.homedir(), '.atlas', 'lancedb');
        // Ensure directory exists
        fs.mkdirSync(this.dbPath, { recursive: true });
    }

    private async connect(): Promise<lancedb.Connection> {
        if (!this.db) {
            this.db = await lancedb.connect(this.dbPath);
        }
        return this.db;
    }

    private async getTable(vectorLength: number = 768): Promise<lancedb.Table> {
        if (this.table) return this.table;

        const db = await this.connect();
        const tableNames = await db.tableNames();

        if (tableNames.includes(TABLE_NAME)) {
            this.table = await db.openTable(TABLE_NAME);
        } else {
            // make the table automatically if it doesn't exist yet
            const schema = new Schema([
                new Field('id', new Utf8()),
                new Field('vector', new FixedSizeList(vectorLength, new Field('item', new Float32()))),
                new Field('document', new Utf8()),
                new Field('filePath', new Utf8()),
                new Field('chunkIndex', new Int32()),
                new Field('lineRangeStart', new Int32()),
                new Field('lineRangeEnd', new Int32()),
                new Field('parentText', new Utf8()),
                new Field('parentLineRangeStart', new Int32()),
                new Field('parentLineRangeEnd', new Int32()),
            ]);
            this.table = await db.createEmptyTable(TABLE_NAME, schema);
        }

        return this.table;
    }

    // saves chunks and their embeddings to the db
    async storeChunks(
        ids: string[],
        embeddings: number[][],
        metadatas: StoredChunkMetadata[],
        documents: string[],
    ): Promise<void> {
        const vectorLength = embeddings.length > 0 ? embeddings[0].length : 768;
        console.log(`[lancedb] Getting table for ${ids.length} chunks (dim: ${vectorLength})...`);
        const table = await this.getTable(vectorLength);

        console.log(`[lancedb] Mapping ${ids.length} chunks to LanceRow format...`);
        const rows: LanceRow[] = ids.map((id, i) => ({
            id,
            vector: embeddings[i],
            document: documents[i],
            filePath: metadatas[i].filePath,
            chunkIndex: metadatas[i].chunkIndex,
            lineRangeStart: metadatas[i].lineRangeStart ?? 0,
            lineRangeEnd: metadatas[i].lineRangeEnd ?? 0,
            parentText: metadatas[i].parentText ?? documents[i],
            parentLineRangeStart: metadatas[i].parentLineRangeStart ?? metadatas[i].lineRangeStart ?? 0,
            parentLineRangeEnd: metadatas[i].parentLineRangeEnd ?? metadatas[i].lineRangeEnd ?? 0,
        }));

        console.log(`[lancedb] Invoking table.add()...`);
        await table.add(rows as any[]);
        console.log(`[lancedb] Successfully added chunks.`);
    }

    // searches the db, returning stuff in the legacy chromadb format so the backend doesnt break
    async similaritySearch(
        queryEmbedding: number[],
        nResults: number = 20,
        where?: Record<string, any>,
    ) {
        const table = await this.getTable(queryEmbedding.length);

        let query = table.vectorSearch(queryEmbedding).limit(nResults);

        // apply filter if there's one
        if (where) {
            const filters = Object.entries(where)
                .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                .join(' AND ');
            query = query.where(filters) as typeof query;
        }

        const results = await query.toArray();

        // format for the legacy API
        return {
            ids: [results.map(r => r.id as string)],
            distances: [results.map(r => (r._distance as number) ?? 0)],
            documents: [results.map(r => r.document as string)],
            metadatas: [results.map(r => ({
                filePath: r.filePath as string,
                chunkIndex: r.chunkIndex as number,
                lineRangeStart: r.lineRangeStart as number,
                lineRangeEnd: r.lineRangeEnd as number,
                parentText: r.parentText as string,
                parentLineRangeStart: r.parentLineRangeStart as number,
                parentLineRangeEnd: r.parentLineRangeEnd as number,
            }))],
        };
    }

    // deletes a file's chunks during re-indexing
    async deleteByFilePath(filePath: string): Promise<void> {
        try {
            const table = await this.getTable();
            await table.delete(`filePath = '${filePath.replace(/'/g, "''")}'`);
        } catch { /* ignore if table doesn't exist yet */ }
    }

    // just a quick count of total blocks
    async count(): Promise<number> {
        try {
            const table = await this.getTable();
            return await table.countRows();
        } catch { return 0; }
    }

    // drops the table basically
    async reset(): Promise<void> {
        try {
            const db = await this.connect();
            await db.dropTable(TABLE_NAME);
            this.table = null;
        } catch { /* ignore */ }
    }
}

// re-export reranker so the rest of the app just imports from here
export { rerank, bm25Scores, crossEncoderScore } from './reranker';
export type { RerankerDoc } from './reranker';
