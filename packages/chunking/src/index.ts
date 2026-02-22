// types for chunks

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

// legacy single-level chunker stuff we're keeping around just in case
const DEFAULT_OPTIONS: ChunkingOptions = {
    sizeInChars: 3200,   // ≈ 800 tokens
    overlapInChars: 800, // ≈ 200 tokens overlap
};

// old chunker that just splits by 800 tokens. leaving it here just in case
export function chunkText(
    text: string,
    filePath: string,
    options: ChunkingOptions = DEFAULT_OPTIONS
): Chunk[] {
    return _splitIntoChunks(text, filePath, options);
}

// new parent-child chunking approach

// child = what we embed and search for
// parent = the full context we actually send to the ai
const CHILD_OPTIONS: ChunkingOptions = {
    sizeInChars: 1600,
    overlapInChars: 400,
};

const PARENT_OPTIONS: ChunkingOptions = {
    sizeInChars: 6000,
    overlapInChars: 1200,
};

export interface ParentChildChunk {
    // gets embedded in the db
    child: Chunk;
    // full text window around the child
    parentText: string;
    // line numbers for the parent window
    parentLineRange: [number, number];
}

// splits into large parent windows, then splits those into small children.
// lets us search accurately without losing the surrounding context.
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

// the actual text splitting math

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
