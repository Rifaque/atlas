import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import os from 'os';

process.on('uncaughtException', (err) => {
    try { fs.writeFileSync(path.join(os.homedir(), '.atlas', 'backend-crash.log'), String(err.stack || err)); } catch { }
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    try { fs.writeFileSync(path.join(os.homedir(), '.atlas', 'backend-crash.log'), String(reason)); } catch { }
    process.exit(1);
});
import { startIndexing, subscribeToJob, jobs } from './indexer';
import {
    buildRagPrompt,
    streamLLMResponse,
    fetchOllamaModels,
    fetchOpenRouterModels,
    checkOllamaStatus,
    hydeQuery,
    summariseHistory,
    type LLMProvider,
    type ConversationTurn,
} from '@atlas/rag';
import { AtlasVectorStore, rerank, type RerankerDoc } from '@atlas/retrieval';
import { parseFile, ALLOWED_EXTENSIONS, DEFAULT_IGNORES } from './crawler';


const fastify = Fastify({
    logger: false,
});

fastify.register(cors, { origin: '*' });

fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({ error: error.message || 'Internal Server Error' });
});

fastify.get('/ping', async () => ({ status: 'ok' }));

// --- Ollama Status & Models ---
fastify.get('/api/status', async () => {
    const isRunning = await checkOllamaStatus();
    return { status: isRunning ? 'online' : 'offline' };
});

fastify.get('/api/models', async () => {
    const models = await fetchOllamaModels();
    return { models };
});

// --- Setup Check (used by the onboarding modal) ---
fastify.get('/api/setup-check', async () => {
    const REQUIRED_MODELS = ['nomic-embed-text', 'llama3.2:latest'];
    const ollamaOk = await checkOllamaStatus();
    let installedModels: string[] = [];
    if (ollamaOk) {
        installedModels = await fetchOllamaModels();
    }

    const models = REQUIRED_MODELS.map(name => ({
        name,
        installed: installedModels.some(m => m === name || m.startsWith(name + ':')),
    }));

    // LanceDB is embedded — no external server needed
    return { ollamaOk, chromaOk: true, models };
});

// --- Pull a model via Ollama ---
fastify.post('/api/pull-model', async (request, reply) => {
    const { model } = request.body as { model: string };
    if (!model) return reply.status(400).send({ error: 'model is required' });

    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    try {
        const res = await fetch('http://127.0.0.1:11434/api/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model, stream: true }),
        });
        if (!res.ok || !res.body) throw new Error(`Ollama pull failed: ${res.statusText}`);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = dec.decode(value);
            for (const line of text.split('\n').filter(Boolean)) {
                try {
                    const json = JSON.parse(line);
                    reply.raw.write(`data: ${JSON.stringify(json)}\n\n`);
                    if (json.status === 'success') break;
                } catch { /* skip malformed */ }
            }
        }
        reply.raw.write('event: done\ndata: {}\n\n');
    } catch (err: any) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
    reply.raw.end();
});

// --- OpenRouter Models ---
fastify.get('/api/openrouter-models', async (request, reply) => {
    const { apiKey } = request.query as { apiKey?: string };
    try {
        const { free, paid } = await fetchOpenRouterModels(apiKey);
        return { free: free.map(m => m.id), paid: paid.map(m => m.id) };
    } catch (err: any) {
        return reply.status(502).send({ error: err.message });
    }
});

// --- Indexing ---
interface IndexRequest { folderPath: string; model: string; }

import { startWatching } from './watcher';

fastify.post('/api/index', async (request, reply) => {
    const { folderPath, model } = request.body as IndexRequest;
    if (!folderPath || !model) {
        return reply.status(400).send({ error: 'folderPath and model are required' });
    }
    const jobId = await startIndexing(folderPath, model);
    startWatching(folderPath, model); // begin background sync
    return { jobId };
});

fastify.get('/api/index-progress/:jobId', (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobs.get(jobId);
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const unsubscribe = subscribeToJob(jobId, (updatedJob) => {
        reply.raw.write(`data: ${JSON.stringify(updatedJob)}\n\n`);
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            reply.raw.end();
            unsubscribe();
        }
    });

    reply.raw.write(`data: ${JSON.stringify(job)}\n\n`);
    request.raw.on('close', () => unsubscribe());
});

// --- Index Stats ---
fastify.get('/api/index-stats', async () => {
    try {
        const store = new AtlasVectorStore();
        const count = await store.count();
        return { count };
    } catch (err: any) {
        return { count: 0 };
    }
});

// --- File Tree ---
export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: FileNode[];
}

const IGNORED_NAMES = new Set(DEFAULT_IGNORES.map(i => i.replace(/\/$/, '')));

function buildFileTree(dirPath: string, maxDepth = 4, currentDepth = 0): FileNode[] {
    if (currentDepth >= maxDepth) return [];
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
        if (entry.name.startsWith('.') || IGNORED_NAMES.has(entry.name) || IGNORED_NAMES.has(entry.name + '/')) continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            const children = buildFileTree(fullPath, maxDepth, currentDepth + 1);
            if (children.length > 0) {
                nodes.push({ name: entry.name, path: fullPath, type: 'dir', children });
            }
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ALLOWED_EXTENSIONS.has(ext)) {
                nodes.push({ name: entry.name, path: fullPath, type: 'file' });
            }
        }
    }

    return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

fastify.get('/api/files', async (request, reply) => {
    const { folderPath } = request.query as { folderPath: string };
    if (!folderPath) return reply.status(400).send({ error: 'folderPath required' });
    if (!fs.existsSync(folderPath)) return reply.status(404).send({ error: 'Folder not found' });

    try {
        const tree = buildFileTree(folderPath);
        return { tree };
    } catch (err: any) {
        return reply.status(500).send({ error: err.message });
    }
});

fastify.get('/api/file/content', async (request, reply) => {
    const { filePath } = request.query as { filePath: string };
    if (!filePath) return reply.status(400).send({ error: 'filePath required' });
    if (!fs.existsSync(filePath)) return reply.status(404).send({ error: 'File not found' });

    try {
        const content = await parseFile(filePath);
        return { content };
    } catch (err: any) {
        return reply.status(500).send({ error: err.message });
    }
});

import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);

fastify.post('/api/sync', async (request, reply) => {
    const { folderPath, model } = request.body as { folderPath: string; model?: string };
    if (!folderPath || !fs.existsSync(folderPath)) {
        return reply.status(400).send({ error: 'Valid folderPath is required' });
    }

    // Just trigger a re-index (incremental — only changed files)
    try {
        const jobId = await startIndexing(folderPath, model || 'nomic-embed-text');
        startWatching(folderPath, model || 'nomic-embed-text');
        return { success: true, message: 'Re-indexing started', jobId };
    } catch (err: any) {
        return reply.status(500).send({ error: `Re-index failed: ${err.message}` });
    }
});

// --- Chat & Retrieval ---
interface ChatRequest {
    query: string;
    model: string;
    provider?: LLMProvider;
    apiKey?: string;
    ollamaHost?: string;
    manualFiles?: string[];
    systemPrompt?: string;
    folderPath?: string;
    /** Rolling conversation history (last N turns, most-recent last) */
    history?: ConversationTurn[];
}

fastify.post('/api/chat', async (request, reply) => {
    const { query, model, provider, apiKey, ollamaHost, manualFiles, systemPrompt, folderPath, history = [] } = request.body as ChatRequest;
    if (!query || !model) {
        return reply.status(400).send({ error: 'query and model are required' });
    }

    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const safeHost = (ollamaHost && ollamaHost.trim()) ? ollamaHost.trim() : 'http://127.0.0.1:11434';
    const llmOpts = { model, provider: provider ?? 'ollama', apiKey, host: safeHost };
    const EMBED_MODEL = 'nomic-embed-text';

    try {
        // ── 1. HyDE: embed a hypothetical answer, not the raw query ────────────
        // HyDE only runs with Ollama (free, local). With OpenRouter we skip it
        // to avoid spending API credits on a warmup call.
        let searchQuery = query;
        if ((provider ?? 'ollama') === 'ollama') {
            try {
                searchQuery = await hydeQuery(query, llmOpts);
                fastify.log.info('[HyDE] hypothetical query generated');
            } catch {
                fastify.log.warn('[HyDE] failed, falling back to raw query');
            }
        }

        // ── 2. Embed search query & retrieve candidates ──────────────────────
        const store = new AtlasVectorStore();
        const { generateEmbeddings } = await import('@atlas/embeddings');
        const [searchEmbedding] = await generateEmbeddings([searchQuery], { model: EMBED_MODEL, host: safeHost });

        // Oversample — fetch 30 candidates so BM25+RRF can do real work
        const CANDIDATE_N = 30;
        const TOP_K = 8;

        // Convert ChromaDB result into RerankerDoc array
        function toRerankerDocs(
            chromaDocs: (string | null)[][],
            chromaMeta: (Record<string, any> | null)[][],
            filterFiles?: string[],
        ): RerankerDoc[] {
            const docs = chromaDocs[0] as (string | null)[];
            const metas = chromaMeta[0] as (Record<string, any> | null)[];
            const result: RerankerDoc[] = [];
            for (let i = 0; i < docs.length; i++) {
                const childText = docs[i] ?? '';
                const meta = metas[i] ?? {};
                if (filterFiles && filterFiles.includes(meta.filePath)) continue;
                result.push({
                    childText,
                    // ── Parent-text swap: LLM reads the wider context window ──
                    parentText: (meta.parentText as string | undefined) || childText,
                    metadata: {
                        filePath: meta.filePath ?? '',
                        lineRangeStart: (meta.parentLineRangeStart ?? meta.lineRangeStart) as number | undefined,
                        lineRangeEnd: (meta.parentLineRangeEnd ?? meta.lineRangeEnd) as number | undefined,
                    },
                });
            }
            return result;
        }

        // ── 3. Retrieve pinned (manual) files first ──────────────────────────
        let manualDocs: RerankerDoc[] = [];
        if (manualFiles && manualFiles.length > 0) {
            for (const fp of manualFiles) {
                try {
                    // Bypass vector store and pass full content for pinned files (up to ~15k chars)
                    const content = await parseFile(fp);
                    const truncated = content.slice(0, 15000);
                    console.log(`[pinned] Loaded ${truncated.length} chars from ${fp}`);
                    manualDocs.push({
                        childText: truncated,
                        parentText: truncated,
                        metadata: { filePath: fp }
                    });
                } catch (err) {
                    console.error(`[chat] manual context load failed for ${fp}`, err);
                    fastify.log.warn(`[chat] manual context load failed for ${fp}`);
                }
            }
        }

        // ── 4. Retrieve auto candidates, exclude pinned file paths ───────────
        let autoDocs: RerankerDoc[] = [];
        const autoResults = await store.similaritySearch(searchEmbedding, CANDIDATE_N);
        const candidateDocs = toRerankerDocs(
            autoResults.documents as any,
            autoResults.metadatas as any,
            manualFiles, // exclude files already in manual context
        );

        // ── 5. BM25 + RRF + Cross-encoder re-rank ────────────────────────────
        const remainingSlots = TOP_K - manualDocs.length;
        autoDocs = rerank(query, candidateDocs, remainingSlots);

        // ── 6. Conversation memory: summarise old history if too long ─────────
        let activeHistory = history;
        const HISTORY_ROLLING_WINDOW = 6;   // last 6 turns sent verbatim
        const HISTORY_SUMMARISE_THRESHOLD = 10; // summarise when > 10 turns

        if (history.length > HISTORY_SUMMARISE_THRESHOLD) {
            const oldTurns = history.slice(0, history.length - HISTORY_ROLLING_WINDOW);
            const recentTurns = history.slice(-HISTORY_ROLLING_WINDOW);
            try {
                const summary = await summariseHistory(oldTurns, llmOpts);
                activeHistory = [
                    { role: 'assistant', content: `[Earlier session summary]: ${summary}` },
                    ...recentTurns,
                ];
            } catch {
                // Summarisation failed — just use the rolling window
                activeHistory = recentTurns;
            }
        } else if (history.length > HISTORY_ROLLING_WINDOW) {
            activeHistory = history.slice(-HISTORY_ROLLING_WINDOW);
        }

        // ── 7. Build prompt with parent context + history ────────────────────
        const manualParentTexts = manualDocs.map(d => d.parentText);
        const autoParentTexts = autoDocs.map(d => d.parentText);

        const allMetas = [
            ...manualDocs.map(d => d.metadata),
            ...autoDocs.map(d => d.metadata),
        ];
        const enrichedMeta = allMetas.map(m => ({
            filePath: m.filePath,
            lineRangeStart: m.lineRangeStart,
            lineRangeEnd: m.lineRangeEnd,
        }));

        reply.raw.write(`event: citations\ndata: ${JSON.stringify(enrichedMeta)}\n\n`);

        let mapContext = '';
        if (folderPath && fs.existsSync(folderPath)) {
            const serializeTree = (nodes: FileNode[], indent = ''): string => {
                let out = '';
                for (const node of nodes) {
                    out += `${indent}- ${node.name}${node.type === 'dir' ? '/' : ''}\n`;
                    if (node.children) out += serializeTree(node.children, indent + '  ');
                }
                return out;
            };
            try {
                const tree = buildFileTree(folderPath, 3);
                mapContext = `\n\n=== PROJECT DIRECTORY MAP (Max Depth 3) ===\n${serializeTree(tree)}\n`;
            } catch (e) {
                // Ignore tree generation failures securely
            }
        }

        const finalSystemPrompt = (systemPrompt || '') + mapContext;
        const prompt = buildRagPrompt(query, autoParentTexts, manualParentTexts, finalSystemPrompt, activeHistory);

        // ── 8. Stream LLM response ───────────────────────────────────────────
        let fullResponse = '';
        for await (const chunk of streamLLMResponse(prompt, llmOpts)) {
            fullResponse += chunk;
            reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }

        // ── 9. Extract follow-up suggestions ────────────────────────────────
        const MARKER = 'FOLLOW_UP_SUGGESTIONS:';
        if (fullResponse.includes(MARKER)) {
            const part = fullResponse.split(MARKER)[1] || '';
            const suggestions = part
                .split('\n')
                .map(l => l.replace(/^\d+\.\s*/, '').replace(/^\[|\]$/g, '').trim())
                .filter(l => l.length > 5)
                .slice(0, 3);
            if (suggestions.length) {
                reply.raw.write(`event: suggestions\ndata: ${JSON.stringify({ suggestions })}\n\n`);
            }
        }

        reply.raw.write('event: done\ndata: {}\n\n');
        reply.raw.end();

    } catch (err: any) {
        fastify.log.error(err);
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        reply.raw.end();
    }
});

// --- Hybrid Search (Semantic + Keyword) ---
fastify.post('/api/search', async (request, reply) => {
    const { query, model, folderPath } = request.body as { query: string; model: string; folderPath?: string };
    if (!query || !model) {
        return reply.status(400).send({ error: 'query and model are required' });
    }

    try {
        const store = new AtlasVectorStore();
        const { generateEmbeddings } = await import('@atlas/embeddings');
        const [queryEmbedding] = await generateEmbeddings([query], { model: 'nomic-embed-text' });

        const results = await store.similaritySearch(queryEmbedding, 20);
        const metadatas = results.metadatas[0] as any[];
        const documents = results.documents[0] as string[];

        // Semantic results grouped by file
        const fileMap = new Map<string, { snippet: string; hits: number; lineRangeStart?: number }>();
        metadatas.forEach((meta, idx) => {
            if (meta?.filePath) {
                if (!fileMap.has(meta.filePath)) {
                    const raw = (documents[idx] || '').replace(/\s+/g, ' ').trim();
                    fileMap.set(meta.filePath, {
                        snippet: raw.substring(0, 200),
                        hits: 1,
                        lineRangeStart: meta.lineRangeStart,
                    });
                } else {
                    fileMap.get(meta.filePath)!.hits++;
                }
            }
        });

        // Keyword grep fallback: scan indexed files for exact matches
        if (folderPath && fs.existsSync(folderPath)) {
            const lowerQuery = query.toLowerCase();
            const keywordHits = new Map<string, { lineNum: number; line: string }>();

            const grepDir = (dir: string) => {
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.name.startsWith('.') || IGNORED_NAMES.has(entry.name) || IGNORED_NAMES.has(entry.name + '/')) continue;
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            grepDir(fullPath);
                        } else {
                            const ext = path.extname(entry.name).toLowerCase();
                            if (!ALLOWED_EXTENSIONS.has(ext)) continue;
                            try {
                                const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
                                for (let i = 0; i < lines.length; i++) {
                                    if (lines[i].toLowerCase().includes(lowerQuery)) {
                                        if (!fileMap.has(fullPath) && !keywordHits.has(fullPath)) {
                                            keywordHits.set(fullPath, { lineNum: i + 1, line: lines[i].trim().substring(0, 120) });
                                        }
                                        break;
                                    }
                                }
                            } catch { /* skip unreadable files */ }
                        }
                    }
                } catch { /* skip unreadable dirs */ }
            };

            grepDir(folderPath);

            // Merge keyword hits (lower priority)
            keywordHits.forEach((val, filePath) => {
                if (!fileMap.has(filePath)) {
                    fileMap.set(filePath, {
                        snippet: `Line ${val.lineNum}: ${val.line}`,
                        hits: 0,
                    });
                }
            });
        }

        const files = Array.from(fileMap.entries())
            .sort((a, b) => b[1].hits - a[1].hits)
            .map(([filePath, { snippet, lineRangeStart }]) => ({ filePath, snippet, lineRangeStart }));

        return { files };
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: err.message });
    }
});

const start = async () => {
    try {
        console.log('Starting backend...');
        await fastify.listen({ port: 47291, host: '127.0.0.1' });
        console.log(`Backend is running on http://127.0.0.1:47291`);
    } catch (err) {
        console.error('Failed to start server:', err);
        try { fs.writeFileSync(path.join(os.homedir(), '.atlas', 'backend-crash.log'), String((err as any)?.stack || err)); } catch { }
        process.exit(1);
    }
};

start();
