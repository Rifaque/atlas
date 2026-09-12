import { FileSearch, Pin, Search } from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { Button, EmptyState, InlineAlert, Input, Spinner } from './ui';

export function FindView({ query, results, searching, error, onQuery, onFind, onOpen, onPin, onAskAbout }: {
    query: string;
    results: SearchResult[];
    searching: boolean;
    error: string | null;
    onQuery: (value: string) => void;
    onFind: () => void;
    onOpen: (result: SearchResult) => void;
    onPin: (path: string) => void;
    onAskAbout: (result: SearchResult) => void;
}) {
    return (
        <section className="find-view" aria-label="Find workspace evidence">
            <form className="find-bar" role="search" onSubmit={event => { event.preventDefault(); onFind(); }}>
                <Search size={16} aria-hidden="true" />
                <Input id="find-input" value={query} onChange={event => onQuery(event.target.value)} placeholder="Find files and passages…" aria-label="Find files and passages" />
                <Button type="submit" variant="primary" loading={searching} disabled={!query.trim()}>Find</Button>
            </form>
            {error && <InlineAlert tone="danger" title="Find failed">{error}</InlineAlert>}
            {searching && results.length === 0 && <div className="find-loading"><Spinner label="Searching workspace" /> Searching workspace…</div>}
            {!query.trim() && results.length === 0 ? (
                <EmptyState icon={<FileSearch size={18} />} title="Find workspace evidence">
                    Search for a symbol, concept, phrase, or file. Find returns source passages directly without creating a chat.
                </EmptyState>
            ) : !searching && !error && results.length === 0 ? (
                <EmptyState title="No source passages returned">Try a different term or ask a broader question in Ask.</EmptyState>
            ) : (
                <div className="find-results" aria-label="Find results">
                    {results.map((result, index) => (
                        <article className="find-result" key={result.id} tabIndex={0} onKeyDown={event => event.key === 'Enter' && onOpen(result)}>
                            <button className="find-result__source" onClick={() => onOpen(result)}>
                                <span className="source-number">{index + 1}</span>
                                <span className="mono">{result.displayPath}</span>
                                <span>Lines {result.lineStart}–{result.lineEnd}</span>
                            </button>
                            <pre>{result.snippet}</pre>
                            <div className="find-result__actions">
                                <Button size="small" variant="quiet" onClick={() => onPin(result.filePath)}><Pin size={13} /> Pin</Button>
                                <Button size="small" onClick={() => onAskAbout(result)}>Ask about this</Button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
