// types

export type LLMProvider = 'ollama' | 'openrouter';

export interface RAGOptions {
    model: string;
    provider?: LLMProvider;
    // default is http://127.0.0.1:11434
    host?: string;
    // your openrouter API key
    apiKey?: string;
    systemPrompt?: string;
}

// a single back-and-forth message
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

// building the actual prompt to send

// formats the final system prompt + context + chat history
// assumes history is already summarized if it's too long
export function buildRagPrompt(
    question: string,
    autoChunks: string[],
    manualChunks: string[] = [],
    systemPrompt?: string,
    history: ConversationTurn[] = [],
): string {
    const autoText = autoChunks.map((c, i) => `--- Context ${i + 1} ---\n${c}`).join('\n\n');
    const manualText = manualChunks.map((c, i) => `--- Pinned Context ${i + 1} ---\n${c}`).join('\n\n');

    const sysBlock = systemPrompt ? `USER INSTRUCTION:\n${systemPrompt}\n` : '';

    // Format conversation history (most-recent last, same order as the chat)
    const historyBlock = history.length > 0
        ? `CONVERSATION HISTORY:\n${history.map(t => `${t.role.toUpperCase()}: ${t.content.slice(0, 500)}`).join('\n')}\n`
        : '';

    return `SYSTEM:
You are an expert programming assistant. Answer the user's question directly using ONLY the context below. Do not add conversational filler or preambles like "Based on the context..." or "Answer:".
Prefer PINNED CONTEXT when answering. Use CONTEXT if needed.
If the answer is not in the context, say so clearly. Do not invent information.
${sysBlock}
PINNED CONTEXT:
${manualText || 'None'}

CONTEXT:
${autoText || 'None'}

${historyBlock}
USER QUESTION:
${question}

IMPORTANT: End your response EXACTLY with this block for follow-up questions:
FOLLOW_UP_SUGGESTIONS:
1. [question]
2. [question]
3. [question]
`;
}

// hyde implementation (fake document generation)

// asks the llm to guess the answer to the user's question.
// we embed this fake answer instead of the raw question because it retrieves better chunks.
// if it fails, we just fallback to the original query.
export async function hydeQuery(
    query: string,
    options: RAGOptions,
): Promise<string> {
    const hydePrompt =
        `Write a brief, realistic code snippet or technical explanation (2-4 sentences or ~10 lines of code) ` +
        `that would directly answer the following question. Do not add preamble.\n\nQuestion: ${query}\n\nAnswer:`;

    let hypothetical = '';
    try {
        for await (const chunk of streamLLMResponse(hydePrompt, options)) {
            hypothetical += chunk;
            // Stop early — we only need 300-500 chars for a good embedding
            if (hypothetical.length > 500) break;
        }
    } catch {
        // HyDE failure is non-fatal — fall back to original query
        return query;
    }

    const result = hypothetical.trim();
    return result.length > 20 ? result : query;
}

// compress old chat history into a few sentences so we don't run out of context
export async function summariseHistory(
    turns: ConversationTurn[],
    options: RAGOptions,
): Promise<string> {
    const formatted = turns
        .map(t => `${t.role.toUpperCase()}: ${t.content.slice(0, 600)}`)
        .join('\n');

    const sumPrompt = `Summarise this conversation in 3-5 sentences, preserving key technical decisions and code references:\n\n${formatted}\n\nSummary:`;

    let summary = '';
    try {
        for await (const chunk of streamLLMResponse(sumPrompt, options)) {
            summary += chunk;
            if (summary.length > 800) break;
        }
    } catch {
        // If summarisation fails, just return a truncated version
        const lastTwo = turns.slice(-2).map(t => `${t.role}: ${t.content.slice(0, 200)}`).join('\n');
        return `[Earlier conversation summarised]\n${lastTwo}`;
    }

    return summary.trim();
}

// ollama util methods

export async function checkOllamaStatus(host = 'http://127.0.0.1:11434'): Promise<boolean> {
    try {
        const res = await fetch(host);
        return res.ok;
    } catch {
        return false;
    }
}

export async function fetchOllamaModels(host = 'http://127.0.0.1:11434'): Promise<string[]> {
    try {
        const res = await fetch(`${host}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json() as any;
        return data.models.map((m: any) => m.name);
    } catch {
        return [];
    }
}

// openrouter api stuff

export interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    pricing: { prompt: string; completion: string };
    context_length: number;
    isFree: boolean;
}

export async function fetchOpenRouterModels(apiKey?: string): Promise<{
    free: OpenRouterModel[];
    paid: OpenRouterModel[];
}> {
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
        if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`);

        const data = await res.json() as { data: any[] };
        const models: OpenRouterModel[] = data.data.map((m: any) => {
            const promptCost = parseFloat(m.pricing?.prompt ?? '1');
            const completionCost = parseFloat(m.pricing?.completion ?? '1');
            return {
                id: m.id,
                name: m.name ?? m.id,
                description: m.description,
                pricing: { prompt: m.pricing?.prompt ?? '?', completion: m.pricing?.completion ?? '?' },
                context_length: m.context_length ?? 0,
                isFree: promptCost === 0 && completionCost === 0,
            };
        });

        const free = models.filter(m => m.isFree).sort((a, b) => a.name.localeCompare(b.name));
        const paid = models.filter(m => !m.isFree).sort((a, b) => a.name.localeCompare(b.name));
        return { free, paid };
    } catch (err) {
        console.error('[OpenRouter] fetchModels error:', err);
        return { free: [], paid: [] };
    }
}

// dealing with streams so the UI doesn't hang

export async function* streamLLMResponse(
    prompt: string,
    options: RAGOptions,
): AsyncGenerator<string, void, unknown> {
    const provider = options.provider ?? 'ollama';
    if (provider === 'openrouter') {
        yield* streamOpenRouter(prompt, options);
    } else {
        yield* streamOllama(prompt, options);
    }
}

// stream from local ollama

async function* streamOllama(
    prompt: string,
    options: RAGOptions,
): AsyncGenerator<string, void, unknown> {
    const host = options.host || 'http://127.0.0.1:11434';
    const response = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model, prompt, stream: true, options: { num_ctx: 32768 } }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`Ollama error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl = buffer.indexOf('\n');
        while (nl !== -1) {
            const line = buffer.substring(0, nl).trim();
            buffer = buffer.substring(nl + 1);
            if (line) {
                try {
                    const json = JSON.parse(line);
                    if (json.response) yield json.response;
                } catch { /* skip */ }
            }
            nl = buffer.indexOf('\n');
        }
    }
}

// parsing sse from openrouter API

async function* streamOpenRouter(
    prompt: string,
    options: RAGOptions,
): AsyncGenerator<string, void, unknown> {
    if (!options.apiKey) {
        throw new Error('OpenRouter API key is required. Add it in Settings.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
            'HTTP-Referer': 'https://atlas-app.local',
            'X-Title': 'Atlas',
        },
        body: JSON.stringify({
            model: options.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        }),
    });

    if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`OpenRouter ${response.status}: ${errBody || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;
            try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) yield delta;
            } catch { /* skip */ }
        }
    }
}
