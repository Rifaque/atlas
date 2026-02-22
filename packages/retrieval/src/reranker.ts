/**
 * packages/retrieval/src/reranker.ts
 *
 * Three-stage re-ranking pipeline (pure TypeScript, zero extra dependencies):
 *
 *   Stage 1 — BM25 scoring
 *   Stage 2 — Reciprocal Rank Fusion (RRF) merging BM25 + cosine ranks
 *   Stage 3 — Cross-encoder approximation (lexical bigram overlap + position bonus)
 *
 * The cross-encoder stage is deliberately lightweight — it uses term-overlap
 * and positional heuristics rather than a neural model, which keeps it
 * dependency-free while still significantly outperforming pure cosine similarity
 * for final re-ranking.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RerankerDoc {
    /** The text of the chunk that was embedded and retrieved */
    childText: string;
    /** The wider parent window returned to the LLM (may equal childText) */
    parentText: string;
    metadata: {
        filePath: string;
        lineRangeStart?: number;
        lineRangeEnd?: number;
        [key: string]: any;
    };
    /** Cosine similarity distance from LanceDB (lower = more similar) */
    cosineDistance?: number;
}

// ─── Tokeniser ────────────────────────────────────────────────────────────────

/** Simple whitespace + punctuation tokeniser, lowercase. */
function tokenise(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1);
}

/** Produce character-level bigrams for fuzzy term matching. */
function bigrams(tokens: string[]): Set<string> {
    const bg = new Set<string>();
    for (const t of tokens) {
        for (let i = 0; i < t.length - 1; i++) bg.add(t.slice(i, i + 2));
    }
    return bg;
}

// ─── Stage 1: BM25 ───────────────────────────────────────────────────────────

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/**
 * Score all docs against queryTokens using BM25.
 * Returns an array of scores aligned with `docs`.
 */
export function bm25Scores(query: string, docs: RerankerDoc[]): number[] {
    const queryTokens = tokenise(query);
    if (queryTokens.length === 0) return docs.map(() => 0);

    // Corpus statistics
    const docTokens = docs.map(d => tokenise(d.childText));
    const avgDl = docTokens.reduce((s, t) => s + t.length, 0) / (docTokens.length || 1);

    // Inverse document frequency for each query term
    const idf: Record<string, number> = {};
    const N = docs.length;
    for (const term of new Set(queryTokens)) {
        const df = docTokens.filter(toks => toks.includes(term)).length;
        idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    }

    return docTokens.map((toks, _di) => {
        const dl = toks.length;
        const tf: Record<string, number> = {};
        for (const t of toks) tf[t] = (tf[t] ?? 0) + 1;

        let score = 0;
        for (const term of queryTokens) {
            const f = tf[term] ?? 0;
            if (f === 0) continue;
            score += idf[term] * ((f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgDl))));
        }
        return score;
    });
}

// ─── Stage 2: Reciprocal Rank Fusion (RRF) ───────────────────────────────────

const RRF_K = 60; // Standard constant from the original RRF paper

/**
 * Merge two score arrays (cosine-rank and bm25-rank) using RRF.
 * Cosine scores are already ranks (position in LanceDB result, 0 = best).
 * BM25 scores are raw BM25 values (higher = better).
 */
export function rrfScores(
    cosineRanks: number[],   // 0-based rank from LanceDB order
    bm25RawScores: number[], // raw BM25 values
): number[] {
    const n = cosineRanks.length;

    // Convert BM25 raw scores → ranks (0 = best BM25 score)
    const bm25Order = [...bm25RawScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([i]) => i);
    const bm25Ranks = new Array<number>(n);
    bm25Order.forEach((docIdx, rank) => { bm25Ranks[docIdx] = rank; });

    return cosineRanks.map((cosineRank, i) => {
        return 1 / (RRF_K + cosineRank) + 1 / (RRF_K + bm25Ranks[i]);
    });
}

// ─── Stage 3: Cross-Encoder Approximation ────────────────────────────────────

/**
 * Lightweight cross-attention scoring between query and a single document.
 *
 * Components:
 *   a) Exact term overlap (weighted by IDF proxy)
 *   b) Character bigram overlap (fuzzy matching for morphological variants)
 *   c) Position bonus — query terms near the start of the chunk score higher
 *   d) Coverage — fraction of query terms that appear at all
 */
export function crossEncoderScore(query: string, doc: string): number {
    const qToks = tokenise(query);
    const dToks = tokenise(doc);
    if (qToks.length === 0 || dToks.length === 0) return 0;

    const dSet = new Set(dToks);
    const qBigrams = bigrams(qToks);
    const dBigrams = bigrams(dToks);

    // (a) Exact overlap — fraction of query terms found in doc
    let exactHits = 0;
    for (const qt of qToks) if (dSet.has(qt)) exactHits++;
    const exactScore = exactHits / qToks.length;

    // (b) Bigram overlap — Jaccard on character bigrams
    let bigramIntersection = 0;
    for (const bg of qBigrams) if (dBigrams.has(bg)) bigramIntersection++;
    const bigramScore = bigramIntersection / Math.max(qBigrams.size, 1);

    // (c) Position bonus — terms found in first 25% of doc score extra
    const earlyWindow = Math.ceil(dToks.length * 0.25);
    const earlySet = new Set(dToks.slice(0, earlyWindow));
    let earlyHits = 0;
    for (const qt of qToks) if (earlySet.has(qt)) earlyHits++;
    const positionBonus = (earlyHits / qToks.length) * 0.3;

    // (d) Coverage — penalise if fewer than half query terms appear
    const coverage = exactHits / qToks.length;
    const coveragePenalty = coverage < 0.5 ? 0.5 : 1.0;

    return (exactScore * 0.5 + bigramScore * 0.3 + positionBonus) * coveragePenalty;
}

// ─── Combined Pipeline ────────────────────────────────────────────────────────

/**
 * Full re-ranking pipeline:
 *   1. BM25 over all candidate docs
 *   2. RRF merge with cosine ranks
 *   3. Cross-encoder re-score
 *   4. Final sort: RRF * 0.6 + crossEncoder * 0.4
 *   5. Return top-k
 */
export function rerank(
    query: string,
    docs: RerankerDoc[],
    topK: number = 8,
): RerankerDoc[] {
    if (docs.length === 0) return [];
    if (docs.length <= topK) {
        // Still apply cross-encoder to sort even small sets
        return [...docs]
            .map(d => ({ d, ce: crossEncoderScore(query, d.childText) }))
            .sort((a, b) => b.ce - a.ce)
            .map(x => x.d)
            .slice(0, topK);
    }

    // Stage 1: BM25
    const bm25 = bm25Scores(query, docs);

    // Stage 2: RRF — cosine rank = original position in LanceDB results
    const cosineRanks = docs.map((_, i) => i);
    const rrf = rrfScores(cosineRanks, bm25);

    // Stage 3: Cross-encoder
    const ce = docs.map(d => crossEncoderScore(query, d.childText));

    // Normalise each score array to [0,1]
    const norm = (arr: number[]) => {
        const max = Math.max(...arr, 1e-9);
        return arr.map(v => v / max);
    };
    const rrfN = norm(rrf);
    const ceN = norm(ce);

    // Final combined score
    const scored = docs.map((d, i) => ({
        d,
        score: rrfN[i] * 0.6 + ceN[i] * 0.4,
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(x => x.d);
}
