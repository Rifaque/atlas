export interface EmbeddingsOptions {
    model: string;
    host?: string; // defaults to http://127.0.0.1:11434
}

export async function generateEmbeddings(
    texts: string[],
    options: EmbeddingsOptions
): Promise<number[][]> {
    const host = options.host || 'http://127.0.0.1:11434';

    // Try new /api/embed first (supports batching)
    let response = await fetch(`${host}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: options.model,
            input: texts,
        })
    });

    if (response.status === 404) {
        // Fallback to legacy /api/embeddings (one by one as it doesn't support batching)
        const results: number[][] = [];
        for (const text of texts) {
            const res = await fetch(`${host}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options.model,
                    prompt: text,
                })
            });

            if (res.status === 404) {
                throw new Error(`Model "${options.model}" not found in Ollama or doesn't support embeddings. Try running "ollama pull nomic-embed-text" and selecting it.`);
            }

            if (!res.ok) {
                throw new Error(`Ollama legacy embeddings API error: ${res.statusText}`);
            }

            const data = await res.json() as { embedding: number[] };
            results.push(data.embedding);
        }
        return results;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Ollama API error (${response.status}): ${errorData.error || response.statusText}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings;
}
