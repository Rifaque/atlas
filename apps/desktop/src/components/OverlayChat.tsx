import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles } from 'lucide-react';
import { startChat, type ChatStreamEvent } from '../lib/api';
import { getActiveWorkspaces } from '../lib/workspaces';

export function OverlayChat() {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [response]);

    const handleSend = async () => {
        if (!query.trim() || isGenerating) return;

        const currentQuery = query;
        setQuery('');
        setResponse('');
        setIsGenerating(true);

        const workspaces = getActiveWorkspaces();
        const workspaceIds = workspaces.map(w => w.id);
        const primary = workspaces[0];

        try {
            await startChat({
                query: currentQuery,
                model: primary?.model || 'llama3.2',
                workspaceIds,
                history: []
            }, (event: ChatStreamEvent) => {
                if (event.type === 'chunk') {
                    setResponse(prev => prev + event.data.chunk);
                } else if (event.type === 'done') {
                    setIsGenerating(false);
                } else if (event.type === 'error') {
                    setResponse(prev => prev + `\n\nError: ${event.data.error}`);
                    setIsGenerating(false);
                }
            });
        } catch (err) {
            setResponse(`Failed to start chat: ${err}`);
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-screen w-screen bg-black/60 backdrop-blur-xl border border-white/10 flex flex-col overflow-hidden font-sans text-white select-none shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                        <Bot size={14} className="text-accent" />
                    </div>
                    <span className="text-sm font-semibold tracking-tight">Atlas Mini</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-text-secondary uppercase font-medium">
                        ALT+SHIFT+SPACE
                    </div>
                </div>
            </div>

            {/* Response Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
            >
                {response ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 text-accent/80">
                            <Sparkles size={12} />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Atlas Response</span>
                        </div>
                        <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap selection:bg-accent/30">
                            {response}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-2 pointer-events-none">
                        <Bot size={32} />
                        <p className="text-xs">How can I help you quickly?</p>
                    </div>
                )}
                {isGenerating && (
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-gradient-to-t from-black/40 to-transparent">
                <div className="relative group">
                    <input
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Quick question..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/[0.05] transition-all placeholder:text-text-secondary/40 pr-12"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isGenerating || !query.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-text-secondary hover:text-accent disabled:opacity-30 disabled:hover:text-text-secondary transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <p className="text-[9px] text-text-secondary/30 mt-3 text-center uppercase tracking-widest font-medium">
                    Press ESC or Shortcut to hide
                </p>
            </div>
        </div>
    );
}
