import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Copy, MessageSquare, Pin, Send, Square } from 'lucide-react';
import type { ChatSession, EvidenceRef } from '../lib/chats';
import type { AtlasSettings } from '../lib/settings';
import { Button, EmptyState, IconButton, InlineAlert, Textarea } from './ui';

export function AskView({
    workspaceName,
    session,
    input,
    generating,
    stopping,
    preflightError,
    canSend,
    settings,
    onInput,
    onAsk,
    onStop,
    onOpenEvidence,
    onOpenContext,
    onExample,
}: {
    workspaceName: string;
    session: ChatSession;
    input: string;
    generating: boolean;
    stopping: boolean;
    preflightError: string | null;
    canSend: boolean;
    settings: AtlasSettings;
    onInput: (value: string) => void;
    onAsk: (query: string) => void;
    onStop: () => void;
    onOpenEvidence: (sources: EvidenceRef[], source?: EvidenceRef) => void;
    onOpenContext: () => void;
    onExample: (value: string) => void;
}) {
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }); }, [session.messages]);
    const destination = settings.generationProvider === 'ollama' ? 'Local · Ollama' : 'Cloud · OpenRouter';
    const examples = ['Where is authentication handled?', 'Explain the indexing pipeline.', 'Summarize this module.'];

    return (
        <section className="ask-view" aria-label="Ask workspace">
            <div className="conversation" role="log" aria-live="polite" aria-relevant="additions text">
                {session.messages.length === 0 ? (
                    <EmptyState icon={<MessageSquare size={18} />} title={`Ask about ${workspaceName}`}>
                        <p>Answers use indexed workspace evidence and any files you pin.</p>
                        <div className="query-examples" aria-label="Example questions">
                            {examples.map(example => <button key={example} onClick={() => onExample(example)}>{example}</button>)}
                        </div>
                    </EmptyState>
                ) : session.messages.map((message, index) => (
                    <article className={`message message--${message.role}`} key={`${index}-${message.role}`}>
                        <div className="message__meta">{message.role === 'user' ? 'You' : 'Atlas'}</div>
                        <div className="message__content prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || (message.status === 'streaming' ? 'Thinking…' : '')}</ReactMarkdown></div>
                        {message.role === 'assistant' && message.evidence && message.evidence.length > 0 && (
                            <button className="evidence-link" onClick={() => onOpenEvidence(message.evidence ?? [], message.evidence?.[0])}>
                                <BookOpen size={14} /> Evidence considered {message.evidence.length}
                            </button>
                        )}
                        {message.status === 'stopped' && <InlineAlert title="Generation stopped">The partial answer was kept.</InlineAlert>}
                        {message.status === 'failed' && (
                            <InlineAlert tone="danger" title={message.error?.toLowerCase().includes('payload') ? 'Request not sent' : 'Generation failed'}>
                                {message.error ?? 'The provider did not complete this response.'}
                            </InlineAlert>
                        )}
                        {message.role === 'assistant' && message.status === 'complete' && (!message.evidence || message.evidence.length === 0) && (
                            <p className="no-sources-note">No workspace sources were returned for this response.</p>
                        )}
                        {message.role === 'assistant' && message.content && (
                            <IconButton label="Copy answer" className="message__copy" onClick={() => void navigator.clipboard.writeText(message.content)}><Copy size={13} /></IconButton>
                        )}
                        {message.followUpSuggestions && message.followUpSuggestions.length > 0 && (
                            <div className="follow-ups">
                                {message.followUpSuggestions.map(suggestion => <button key={suggestion} onClick={() => onAsk(suggestion)}>{suggestion}</button>)}
                            </div>
                        )}
                    </article>
                ))}
                <div ref={endRef} />
            </div>

            <div className="composer-wrap">
                {preflightError && <InlineAlert tone="warning" title="Cloud authorization required">{preflightError}</InlineAlert>}
                <form className="composer" onSubmit={event => { event.preventDefault(); onAsk(input); }}>
                    <Textarea
                        id="ask-composer"
                        value={input}
                        rows={1}
                        onChange={event => onInput(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                onAsk(input);
                            }
                        }}
                        placeholder="Ask a grounded question about this workspace…"
                        aria-label="Ask a question"
                    />
                    <div className="composer__footer">
                        <button type="button" className="context-indicator" onClick={onOpenContext}>
                            <Pin size={13} /> Context{session.manualContext.length ? ` · ${session.manualContext.length} file${session.manualContext.length === 1 ? '' : 's'}` : ''}{settings.includeGitContext ? ' · Git on' : ''}
                        </button>
                        <div className="composer__destination">
                            <span title={settings.generationModel}>{destination}</span>
                            {generating ? (
                                <Button type="button" variant="danger" size="small" onClick={onStop} loading={stopping}><Square size={12} /> {stopping ? 'Stopping' : 'Stop'}</Button>
                            ) : (
                                <Button type="submit" variant="primary" size="small" disabled={!input.trim() || !canSend}>
                                    <Send size={14} /> {settings.generationProvider === 'openrouter' ? 'Send to OpenRouter' : 'Send'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </section>
    );
}
