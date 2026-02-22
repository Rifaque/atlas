// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkMetadata {
    filePath: string;
    chunkIndex: number;
    lineRange: [number, number];
}

export interface Chunk {
    text: string;
    metadata: ChunkMetadata;
}

export interface ChunkingOptions {
    sizeInChars: number;
    overlapInChars: number;
}

// ── Default (original) chunking — kept for backward compat ──────────────────
const DEFAULT_OPTIONS: ChunkingOptions = {
    sizeInChars: 3200,   // ≈ 800 tokens
    overlapInChars: 800, // ≈ 200 tokens overlap
};

/**
 * Original fixed-size chunker.
 * Produces chunks of ~800 tokens with 200-token overlap.
 * Used by the classic single-level index path.
 */
export function chunkText(
    text: string,
    filePath: string,
    options: ChunkingOptions = DEFAULT_OPTIONS
): Chunk[] {
    return _splitIntoChunks(text, filePath, options);
}

// ─── Parent-Child Chunking ─────────────────────────────────────────────────────

/**
 * Sizes for parent-child chunking:
 *   CHILD  — small, embedded for precise retrieval (~400 tokens = ~1600 chars)
 *   PARENT — large, sent to the LLM for full context (~1500 tokens = ~6000 chars)
 *            with 300-token overlap between parents
 */
const CHILD_OPTIONS: ChunkingOptions = {
    sizeInChars: 1600,
    overlapInChars: 400,
};

const PARENT_OPTIONS: ChunkingOptions = {
    sizeInChars: 6000,
    overlapInChars: 1200,
};

export interface ParentChildChunk {
    /** Small chunk — embedded and stored in the vector index */
    child: Chunk;
    /** Full parent window — stored as metadata alongside the child embedding */
    parentText: string;
    /** Line range of the parent window */
    parentLineRange: [number, number];
}

/**
 * Two-level chunker:
 * 1. Splits text into large PARENT windows (≈1500 tokens).
 * 2. Splits each parent into small CHILD chunks (≈400 tokens).
 * 3. Each child carries its parent text, enabling retrieval-at-child +
 *    context-at-parent without any extra DB lookups.
 */
export function chunkTextParentChild(
    text: string,
    filePath: string,
): ParentChildChunk[] {
    const parents = _splitIntoChunks(text, filePath, PARENT_OPTIONS);
    const result: ParentChildChunk[] = [];

    let globalChildIndex = 0;

    for (const parent of parents) {
        const children = _splitIntoChunks(
            parent.text,
            filePath,
            CHILD_OPTIONS
        );

        for (const child of children) {
            // Remap child line numbers to absolute positions in the file
            const lineOffset = parent.metadata.lineRange[0] - 1;
            const absStart = child.metadata.lineRange[0] + lineOffset;
            const absEnd = child.metadata.lineRange[1] + lineOffset;

            result.push({
                child: {
                    text: child.text,
                    metadata: {
                        filePath,
                        chunkIndex: globalChildIndex++,
                        lineRange: [absStart, absEnd],
                    },
                },
                parentText: parent.text,
                parentLineRange: parent.metadata.lineRange,
            });
        }
    }

    return result;
}

// ─── Internal splitter ─────────────────────────────────────────────────────────

function _splitIntoChunks(
    text: string,
    filePath: string,
    options: ChunkingOptions
): Chunk[] {
    const { sizeInChars, overlapInChars } = options;
    if (sizeInChars <= overlapInChars) {
        throw new Error('Chunk size must be greater than overlap');
    }

    const chunks: Chunk[] = [];
    const lines = text.split('\n');

    let currentChunkText = '';
    let currentChunkStartLine = 1;
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (currentChunkText.length === 0) {
            currentChunkText = line;
            currentChunkStartLine = i + 1;
        } else {
            currentChunkText += '\n' + line;
        }

        if (currentChunkText.length >= sizeInChars && i !== lines.length - 1) {
            chunks.push({
                text: currentChunkText,
                metadata: { filePath, chunkIndex: chunkIndex++, lineRange: [currentChunkStartLine, i + 1] },
            });

            // Overlap: step back to gather the last `overlapInChars` of text
            let overlapText = '';
            let overlapStartLine = i + 1;

            for (let j = i; j >= Math.max(0, currentChunkStartLine - 1); j--) {
                const candidate = lines[j] + (overlapText ? '\n' + overlapText : '');
                if (candidate.length > overlapInChars) break;
                overlapText = candidate;
                overlapStartLine = j + 1;
            }

            currentChunkText = overlapText;
            currentChunkStartLine = overlapStartLine;
        }
    }

    if (currentChunkText.trim().length > 0) {
        chunks.push({
            text: currentChunkText,
            metadata: { filePath, chunkIndex: chunkIndex++, lineRange: [currentChunkStartLine, lines.length] },
        });
    }

    return chunks;
}
