import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Search, MessageSquare, Send, PanelLeftClose, PanelLeft, Bot,
    FileText, Loader2, PlusCircle, Plus, X, Pin, Trash2, Pencil,
    Check, Copy, Settings, StopCircle, Download, GitBranch, RefreshCcw, ArrowDown,
    Maximize2, Minimize2, Sun, Moon, Image as ImageIcon
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { searchFiles, fetchFileTree, fetchIndexStats, fetchModels, fetchOpenRouterModels, startChat, checkOllamaStatus, scanSecrets, fetchTimeline, type SearchResult, type FileNode, type SecretMatch } from '../lib/api';
import {
    loadChats, saveChat, createNewChat, deleteChat, renameChat,
    type ChatSession, type CitationRef
} from '../lib/chats';
import { SettingsModal, loadSettings, persistSettings, type AtlasSettings } from './SettingsModal';
import { FileTree } from './FileTree';
import { toast } from '../lib/toast';
import { patchWorkspace, type Workspace } from '../lib/workspaces';
import { InlineFileViewer } from './InlineFileViewer';
import { CommandPalette, type CommandPaletteAction } from './CommandPalette';
import { toggleTheme, getCurrentTheme } from '../lib/theme';
import { PERSONAS, getPersona, type Persona } from '../lib/personas';
import { ModelSelector } from './ModelSelector';

// code block that you can click to copy
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
    const [copied, setCopied] = useState(false);
    const code = String(children ?? '').replace(/\n$/, '');
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'text';

    const copy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <div className="relative group/code my-3 overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--code-bg)]">
            <div className="flex items-center justify-between px-3 py-1 bg-[var(--border-subtle)] text-text-secondary text-[10px] font-mono border-b border-[var(--glass-border)]">
                <span>{lang}</span>
                <button onClick={copy} className="p-1 hover:text-white transition-colors" title="Copy">
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                </button>
            </div>
            <div className="overflow-x-auto text-[11px] leading-relaxed relative">
                <SyntaxHighlighter
                    language={lang}
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, background: 'transparent', padding: '1rem' }}
                    PreTag="div"
                >
                    {code}
                </SyntaxHighlighter>
            </div>
        </div>
    );
}

// main workspace layout
interface WorkspaceLayoutProps {
    workspace: Workspace;
    onLeaveWorkspace: () => void;
}

export function WorkspaceLayout({ workspace, onLeaveWorkspace }: WorkspaceLayoutProps) {
    // Settings
    const [settings, setSettings] = useState<AtlasSettings>(loadSettings);
    const [showSettings, setShowSettings] = useState(false);
    const [indexedChunks, setIndexedChunks] = useState<number | undefined>();
    // backendUrl no longer needed — all calls go through Tauri IPC
    const model = settings.model || workspace.model;
    const provider = settings.provider ?? 'ollama';
    const apiKey = settings.openRouterApiKey ?? '';

    // Layout & Tools
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [zenMode, setZenMode] = useState(() => {
        const saved = localStorage.getItem('atlas-zen-mode');
        return saved !== null ? saved === 'true' : true; // default ON
    });
    const [leftTab, setLeftTab] = useState<'search' | 'files' | 'active'>('search');
    const [previewFile, setPreviewFile] = useState<{ filePath: string; lineStart?: number } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [overrideModel, setOverrideModel] = useState<string>(''); // For multi-model routing
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(getCurrentTheme);
    const [activePersona, setActivePersona] = useState<string>('default');
    const [showPersonaPicker, setShowPersonaPicker] = useState(false);
    const [shieldWarning, setShieldWarning] = useState<{ secrets: SecretMatch[]; query: string } | null>(null);
    const [attachedImages, setAttachedImages] = useState<string[]>([]);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const toggleZenMode = useCallback(() => {
        setZenMode(prev => {
            const next = !prev;
            localStorage.setItem('atlas-zen-mode', String(next));
            return next;
        });
    }, []);

    // Available models for routing
    const [availableModels, setAvailableModels] = useState<{ local: string[]; orFree: string[]; orPaid: string[] }>({ local: [], orFree: [], orPaid: [] });

    useEffect(() => {
        const loadAvailable = async () => {
            const orRes = await fetchOpenRouterModels(apiKey);
            const ollamaRes = await fetchModels();
            setAvailableModels({ local: ollamaRes, orFree: orRes.free, orPaid: orRes.paid });
        };
        loadAvailable();
    }, [apiKey]);

    // Ollama status
    const [ollamaOnline, setOllamaOnline] = useState(false);
    useEffect(() => {
        const check = async () => {
            const status = await checkOllamaStatus();
            setOllamaOnline(status === 'online');
        };
        check();
        const id = setInterval(check, 10000);
        return () => clearInterval(id);
    }, [settings.ollamaHost]);

    // Index stats
    useEffect(() => {
        fetchIndexStats().then(s => setIndexedChunks(s.count));
    }, []);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // File tree
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [treeLoaded, setTreeLoaded] = useState(false);

    // Chat
    const [inputQuery, setInputQuery] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // Sessions
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Migration: Update 'llama3' to 'llama3.2:latest' automatically if it's the exact match
    useEffect(() => {
        if (workspace.model === 'llama3') {
            patchWorkspace(workspace.id, { model: 'llama3.2:latest' });
        }
        if (settings.model === 'llama3') {
            const next = { ...settings, model: 'llama3.2:latest' };
            setSettings(next);
            persistSettings(next);
        }
    }, [workspace.id, workspace.model, settings.model]);

    // Load chats on mount
    useEffect(() => {
        loadChats().then(loaded => {
            // Filter out old empty chats to prevent accumulating blank sessions
            const cleaned = loaded.filter(c => c.messages.length > 0 || c.title !== 'New Chat');
            const newChat = createNewChat();
            setActiveSession(newChat);
            setSessions([newChat, ...cleaned]);
        });
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeSession?.messages, isGenerating]);

    const handleChatScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 150);
    };

    const handleScrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'k') { e.preventDefault(); setShowCommandPalette(true); }
                if (e.key === 'j') { e.preventDefault(); toggleZenMode(); }
                if (e.key === ',') { e.preventDefault(); setShowSettings(true); }
                if (e.key === 'f') { e.preventDefault(); if (zenMode) toggleZenMode(); setLeftTab('search'); }
                if (e.key === '/') { e.preventDefault(); document.getElementById('chat-input')?.focus(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isGenerating]);

    // event handlers
    const handleSaveSettings = (s: AtlasSettings) => { setSettings(s); persistSettings(s); toast('Settings saved ✓', 'success'); };

    const handleNewChat = () => {
        if (isGenerating) return;
        const c = createNewChat();
        setActiveSession(c);
        setSessions(p => [c, ...p]);
        toast('New chat created', 'info');
    };

    const handleSelectChat = (s: ChatSession) => { if (!isGenerating) setActiveSession(s); };

    const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await deleteChat(id);
        setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeSession?.id === id) setActiveSession(next[0] ?? null);
            return next;
        });
        toast('Chat deleted', 'info');
    };

    const handleCommitRename = async (session: ChatSession) => {
        if (!renameValue.trim()) { setRenamingId(null); return; }
        await renameChat(session, renameValue.trim());
        setSessions(p => p.map(s => s.id === session.id ? { ...s, title: renameValue.trim() } : s));
        if (activeSession?.id === session.id) setActiveSession(p => p ? { ...p, title: renameValue.trim() } : null);
        setRenamingId(null);
    };

    const handlePinFile = useCallback((filePath: string) => {
        setActiveSession(prev => {
            if (!prev) return null;
            const ctx = prev.manualContext || [];
            if (ctx.includes(filePath)) return prev;
            toast(`Pinned ${filePath.split(/[/\\]/).pop()}`, 'success');
            return { ...prev, manualContext: [...ctx, filePath] };
        });
    }, []);

    const handleUnpinFile = useCallback((filePath: string) => {
        setActiveSession(prev => prev ? { ...prev, manualContext: (prev.manualContext || []).filter(p => p !== filePath) } : null);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const r = await searchFiles(searchQuery, workspace.model, workspace.folderPath);
            setSearchResults(r);
            if (r.length === 0) toast('No files matched your query', 'info');
        } catch { toast('Search failed', 'error'); }
        finally { setIsSearching(false); }
    };

    const handleLoadFileTree = async () => {
        if (treeLoaded) return;
        setTreeLoaded(true);
        const tree = await fetchFileTree(workspace.folderPath);
        setFileTree(tree);
    };

    const handleOpenFile = (filePath: string, line?: number) => {
        setPreviewFile({ filePath, lineStart: line });
    };

    const handleBranchChat = async (messageIndex: number) => {
        if (!activeSession) return;
        const branchMessages = activeSession.messages.slice(0, messageIndex + 1);
        const newSession = createNewChat();
        newSession.title = `${activeSession.title} (Branch)`;
        newSession.messages = branchMessages;
        newSession.manualContext = [...(activeSession.manualContext || [])];

        await saveChat(newSession);
        setSessions(prev => [newSession, ...prev]);
        setActiveSession(newSession);
        toast('Created new chat branch', 'success');
    };

    // Export chat as markdown
    const handleExportChat = () => {
        if (!activeSession || activeSession.messages.length === 0) { toast('Nothing to export', 'info'); return; }
        const md = activeSession.messages.map(m =>
            `## ${m.role === 'user' ? '👤 You' : '🤖 Atlas'}\n\n${m.content}${m.citations?.length ? `\n\n*Sources: ${m.citations.map(c => c.split(/[/\\]/).pop()).join(', ')}*` : ''}`
        ).join('\n\n---\n\n');
        const blob = new Blob([`# ${activeSession.title}\n\n${md}`], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${activeSession.title.replace(/\s+/g, '_')}.md`; a.click();
        URL.revokeObjectURL(url);
        toast('Chat exported as Markdown', 'success');
    };

    const handleReindex = () => {
        setShowSettings(false);
        onLeaveWorkspace();
        toast('Returning to workspace setup to re-index', 'info');
    };

    const handleSyncWorkspace = async () => {
        setIsSyncing(true);
        toast('Workspace sync is handled automatically by the Rust core', 'info');
        setIsSyncing(false);
    };

    const handleStop = () => { abortRef.current?.abort(); toast('Generation stopped', 'info'); };

    const handleTimeline = async (hours: number = 24) => {
        if (!activeSession) return;
        try {
            const events = await fetchTimeline(workspace.folderPath, hours);
            if (events.length === 0) {
                toast('No recent changes found.', 'info');
                return;
            }
            const timelineText = events.map(e => `- ${e.relative_path} (modified ${new Date(e.mtime).toLocaleString()})`).join('\n');
            const timelineQuery = `Analyze the following recent changes in the workspace (last ${hours} hours):\n${timelineText}\nWhat are the main changes and their impact?`;
            // Directly start chat with this query, bypass input field
            await startChat({
                query: timelineQuery,
                model: overrideModel || model,
                provider,
                apiKey: provider === 'openrouter' ? apiKey : undefined,
                ollamaHost: provider === 'ollama' ? settings.ollamaHost : undefined,
                manualFiles: activeSession.manualContext || [],
                systemPrompt: settings.systemPrompt,
                folderPath: workspace.folderPath,
                history: [],
                embeddingModel: workspace.model,
                persona: activePersona !== 'default' ? activePersona : undefined,
                webSearchEnabled: settings.webSearchEnabled || false,
                webSearchApiKey: settings.webSearchEnabled ? settings.webSearchApiKey : undefined,
                webSearchProvider: settings.webSearchEnabled ? settings.webSearchProvider : undefined,
                images: [],
            }, (_event) => {
                // Reuse existing event handling logic (could refactor, but for now just ignore)
            });
        } catch (e) {
            toast('Failed to fetch timeline.', 'error');
        }
    };



    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                toast('Only images are supported', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = (ev.target?.result as string).split(',')[1];
                setAttachedImages(prev => [...prev, base64]);
            };
            reader.readAsDataURL(file);
        });
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleRemoveImage = (index: number) => {
        setAttachedImages(prev => prev.filter((_, i) => i !== index));
    };

    // handling chat submission
    const handleSubmitChat = async (e?: React.FormEvent, overrideQuery?: string) => {
        if (e) e.preventDefault();
        const q = (overrideQuery ?? inputQuery).trim();
        if (!q || isGenerating || !activeSession) return;

        // Secret Shield: scan outgoing messages when using cloud providers
        if (provider === 'openrouter') {
            const secrets = await scanSecrets(q);
            if (secrets.length > 0) {
                setShieldWarning({ secrets, query: q });
                return; // block until user confirms
            }
        }

        await executeChat(q);
    };

    const handleShieldProceed = () => {
        if (shieldWarning) {
            executeChat(shieldWarning.query);
            setShieldWarning(null);
        }
    };

    const executeChat = async (q: string) => {
        if (!activeSession) return;

        setActiveSession(p => p ? { ...p, messages: [...p.messages, { role: 'user', content: q }] } : null);
        setInputQuery('');
        setAttachedImages([]);
        setIsGenerating(true);

        const activeModel = overrideModel || model;

        let content = '';
        let citations: string[] = [];
        let citationRefs: CitationRef[] = [];

        setActiveSession(p => p ? { ...p, messages: [...p.messages, { role: 'assistant', content: '', citations: [] }] } : null);

        let unlistenFn: (() => void) | null = null;

        try {
            // Build rolling conversation history — exclude the empty assistant message we just appended
            const MAX_HISTORY_TURNS = 20;
            const history = (activeSession.messages || [])
                .slice(0, -1)  // exclude the placeholder assistant message just added
                .slice(-MAX_HISTORY_TURNS)
                .map(m => {
                    let histContent = m.content;
                    if (m.role === 'assistant') {
                        const match = histContent.match(/(?:\n|^)\s*(?:FOLLOW_UP_SUGGESTIONS|Follow-up suggestions|Follow up suggestions|Follow-up question)s?\s*:?\s*(?:\n|$)/i);
                        if (match && match.index !== undefined) {
                            histContent = histContent.slice(0, match.index).trimEnd();
                        }
                    }
                    return { role: m.role as 'user' | 'assistant', content: histContent };
                });

            const { unlisten } = await startChat(
                {
                    query: q,
                    model: activeModel,
                    provider,
                    apiKey: provider === 'openrouter' ? apiKey : undefined,
                    ollamaHost: provider === 'ollama' ? settings.ollamaHost : undefined,
                    manualFiles: activeSession.manualContext || [],
                    systemPrompt: settings.systemPrompt,
                    folderPath: workspace.folderPath,
                    history,
                    embeddingModel: workspace.model, // match indexed vector dimensions
                    persona: activePersona !== 'default' ? activePersona : undefined,
                    webSearchEnabled: settings.webSearchEnabled || false,
                    webSearchApiKey: settings.webSearchEnabled ? settings.webSearchApiKey : undefined,
                    webSearchProvider: settings.webSearchEnabled ? settings.webSearchProvider : undefined,
                    images: attachedImages.length > 0 ? attachedImages : undefined,
                },
                (event) => {
                    if (event.type === 'chunk' && event.data?.chunk !== undefined) {
                        content += event.data.chunk;

                        const match = content.match(/(?:\n|^)\s*(?:FOLLOW_UP_SUGGESTIONS|Follow-up suggestions|Follow up suggestions|Follow-up question)s?\s*:?\s*(?:\n|$)/i);
                        const displayContent = match && match.index !== undefined
                            ? content.slice(0, match.index).trimEnd()
                            : content;

                        setActiveSession(p => {
                            if (!p) return null;
                            const msgs = [...p.messages];
                            msgs[msgs.length - 1] = {
                                role: 'assistant',
                                content: displayContent,
                                citations,
                                citationRefs,
                            };
                            return { ...p, messages: msgs };
                        });

                    } else if (event.type === 'citations') {
                        citationRefs = (event.data as any[]).filter((m: any) => m?.filePath);
                        citations = [...new Set(citationRefs.map((m: any) => m.filePath))];

                    } else if (event.type === 'suggestions') {
                        const suggestions: string[] = event.data?.suggestions || [];
                        setActiveSession(p => {
                            if (!p) return null;
                            const msgs = [...p.messages];
                            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], followUpSuggestions: suggestions };
                            return { ...p, messages: msgs };
                        });

                    } else if (event.type === 'error') {
                        content += `\n\n**Error:** ${event.data?.error}`;
                        toast(event.data?.error, 'error');
                        setActiveSession(p => {
                            if (!p) return null;
                            const msgs = [...p.messages];
                            msgs[msgs.length - 1] = { role: 'assistant', content, citations, citationRefs };
                            return { ...p, messages: msgs };
                        });

                    } else if (event.type === 'done') {
                        // Chat complete — save and clean up
                        setActiveSession(p => {
                            if (!p) return null;
                            const nextP = { ...p };
                            saveChat(nextP).then(() => {
                                setSessions(c => c.map(s => s.id === nextP.id ? nextP : s).sort((a, b) => b.updatedAt - a.updatedAt));
                            }).catch(console.error);
                            return nextP;
                        });
                        setIsGenerating(false);
                        if (unlistenFn) unlistenFn();
                    }
                },
            );

            unlistenFn = unlisten;

        } catch (err: any) {
            setActiveSession(p => {
                if (!p) return null;
                const msgs = [...p.messages];
                msgs[msgs.length - 1].content = '**Connection to backend failed.** Make sure the API is running.';
                return { ...p, messages: msgs };
            });
            toast('Backend connection failed', 'error');
            setIsGenerating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitChat(); e.currentTarget.style.height = '72px'; }
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputQuery(e.target.value);
        e.target.style.height = '72px';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
    };

    const markdownComponents = {
        code({ className, children, ...props }: any) {
            if (className?.startsWith('language-')) return <CodeBlock className={className}>{children}</CodeBlock>;
            return <code className="bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded text-[#e6a050] text-xs font-mono" {...props}>{children}</code>;
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const mockEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleImageUpload(mockEvent);
        }
    };

    // actual UI render
    return (
        <div className="flex h-screen w-screen overflow-hidden text-text-primary bg-bg-main"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {showSettings && (
                <SettingsModal settings={settings} indexedChunks={indexedChunks}
                    onSave={handleSaveSettings} onReindex={handleReindex} onClose={() => setShowSettings(false)} />
            )}

            {previewFile && (
                <InlineFileViewer
                    filePath={previewFile.filePath}
                    lineStart={previewFile.lineStart}
                    onClose={() => setPreviewFile(null)}
                />
            )}

            {/* Secret Shield Warning Modal */}
            {shieldWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShieldWarning(null)}>
                    <div className="bg-[#0f1520] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 text-red-400">
                            <span className="text-lg">🛡️</span>
                            <span className="font-semibold text-sm">Secret Shield — Sensitive Data Detected</span>
                        </div>
                        <p className="text-xs text-text-secondary">
                            Your message contains potential secrets that will be sent to an external server (OpenRouter).
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {shieldWarning.secrets.map((s, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-xs">
                                    <span className="text-red-400 font-medium shrink-0">{s.kind}</span>
                                    <code className="text-text-secondary font-mono truncate">{s.preview}</code>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShieldWarning(null)}
                                className="flex-1 py-2 text-sm font-medium rounded-lg border border-glass-border text-text-secondary hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleShieldProceed}
                                className="flex-1 py-2 text-sm font-medium rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                                Send Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Command Palette */}
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                sessions={sessions}
                fileTree={fileTree}
                onSelectChat={(s) => { handleSelectChat(s); }}
                onOpenFile={(fp) => handleOpenFile(fp)}
                actions={[
                    { id: 'new-chat', label: 'New Chat', icon: <PlusCircle size={14} className="text-accent" />, category: 'action', onSelect: handleNewChat },
                    { id: 'settings', label: 'Open Settings', icon: <Settings size={14} />, category: 'action', onSelect: () => setShowSettings(true) },
                    { id: 'zen-toggle', label: zenMode ? 'Exit Zen Mode' : 'Enter Zen Mode', icon: <Maximize2 size={14} />, category: 'action', onSelect: toggleZenMode },
                    { id: 'export', label: 'Export Chat as Markdown', icon: <Download size={14} />, category: 'action', onSelect: handleExportChat },
                    { id: 'sync', label: 'Sync Workspace', icon: <RefreshCcw size={14} />, category: 'action', onSelect: handleSyncWorkspace },
                    { id: 'timeline', label: 'Timeline: What changed recently?', icon: <RefreshCcw size={14} />, category: 'action', onSelect: () => handleTimeline(24) },
                ] as CommandPaletteAction[]}
            />

            {/* Sidebar — hidden in Zen Mode */}
            <aside className={`transition-all duration-300 border-r border-glass-border bg-bg-surface flex flex-col shrink-0 ${zenMode ? 'w-0 border-r-0 opacity-0 overflow-hidden' : sidebarOpen ? 'w-60' : 'w-0 border-r-0 opacity-0 overflow-hidden'}`}>
                <div className="p-3 border-b border-glass-border flex items-center justify-between whitespace-nowrap">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Chats</span>
                    <div className="flex items-center gap-1">
                        <button onClick={handleNewChat} data-tooltip="New Chat (Ctrl+K)" className="p-1 text-text-secondary hover:text-white transition-colors" title=""><PlusCircle size={14} /></button>
                        <button onClick={handleExportChat} data-tooltip="Export Chat" className="p-1 text-text-secondary hover:text-text-primary transition-colors" title=""><Download size={14} /></button>
                        <button
                            onClick={() => { const next = toggleTheme(); setCurrentTheme(next === 'dark' ? 'dark' : 'light'); }}
                            data-tooltip="Toggle Theme"
                            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                            title=""
                        >
                            {currentTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <button onClick={() => setShowSettings(true)} data-tooltip="Settings (Ctrl+,)" className="p-1 text-text-secondary hover:text-text-primary transition-colors" title=""><Settings size={14} /></button>
                        <button onClick={() => setSidebarOpen(false)} data-tooltip="Collapse" className="p-1 text-text-secondary hover:text-white transition-colors" title=""><PanelLeftClose size={14} /></button>
                    </div>
                </div>

                <div className="flex-1 p-2 overflow-y-auto space-y-0.5">
                    {sessions.map(session => (
                        <div key={session.id} onClick={() => handleSelectChat(session)}
                            className={`p-2 rounded-lg cursor-pointer flex items-center gap-2 group transition-colors ${activeSession?.id === session.id ? 'bg-accent-muted text-text-primary' : 'hover:bg-bg-surface-hover text-text-secondary'}`}>
                            <MessageSquare size={12} className={`shrink-0 ${activeSession?.id === session.id ? 'text-accent' : 'opacity-40'}`} />
                            {renamingId === session.id ? (
                                <input autoFocus value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCommitRename(session); if (e.key === 'Escape') setRenamingId(null); }}
                                    onBlur={() => handleCommitRename(session)}
                                    onClick={e => e.stopPropagation()}
                                    className="flex-1 bg-transparent border-b border-accent text-white text-xs focus:outline-none" />
                            ) : (
                                <span className="flex-1 truncate text-xs">{session.title}</span>
                            )}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={e => { e.stopPropagation(); setRenamingId(session.id); setRenameValue(session.title); }} className="p-1 hover:text-accent transition-colors"><Pencil size={10} /></button>
                                <button onClick={e => handleDeleteChat(session.id, e)} className="p-1 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-3 border-t border-glass-border text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                        {provider === 'openrouter' ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)] animate-pulse" />
                                <span className="text-text-secondary">OpenRouter</span>
                            </>
                        ) : (
                            <>
                                <div className={`w-1.5 h-1.5 rounded-full ${ollamaOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-text-secondary">{ollamaOnline ? 'Ollama Online' : 'Ollama Offline'}</span>
                            </>
                        )}
                        <button onClick={handleSyncWorkspace} disabled={isSyncing} className="ml-auto text-[10px] flex items-center gap-1 text-text-secondary hover:text-white transition-colors disabled:opacity-50">
                            <RefreshCcw size={10} className={isSyncing ? 'animate-spin' : ''} />
                            Sync
                        </button>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                        <span className="truncate opacity-70">{workspace.name}</span>
                        <span className="font-mono text-[10px] bg-glass-bg px-1.5 py-0.5 rounded border border-glass-border ml-1 shrink-0">{model}</span>
                    </div>
                    <button onClick={onLeaveWorkspace} className="w-full text-left text-text-secondary/50 hover:text-text-secondary text-[10px] transition-colors">← Switch Workspace</button>
                </div>
            </aside>

            {/* Resizable Panels */}
            <PanelGroup autoSaveId="atlas-main-layout" direction="horizontal" className="flex-1 overflow-hidden">
                {/* Search / File Tree Panel — hidden in Zen Mode */}
                {!zenMode && (
                    <Panel id="sidebar-tools" order={1} defaultSize={28} minSize={18} maxSize={45}>
                        <section className="h-full border-r border-glass-border bg-[rgba(20,25,35,0.12)] flex flex-col">
                            {/* Tab header */}
                            <div className="flex border-b border-[rgba(255,255,255,0.04)] text-xs font-medium shrink-0 relative">
                                {!sidebarOpen && (
                                    <button onClick={() => setSidebarOpen(true)} className="absolute left-2 top-3 z-10 text-text-secondary hover:text-white transition-colors">
                                        <PanelLeft size={14} />
                                    </button>
                                )}
                                {(['search', 'files', 'active'] as const).map(tab => (
                                    <button key={tab} onClick={() => { setLeftTab(tab); if (tab === 'files' && !treeLoaded) handleLoadFileTree(); }}
                                        className={`flex-1 py-2.5 capitalize transition-colors ${leftTab === tab ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'} ${tab === 'search' && !sidebarOpen ? 'pl-7' : ''}`}>
                                        {tab === 'active' ? 'Context' : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Search Tab */}
                            {leftTab === 'search' && (
                                <>
                                    <div className="p-3 border-b border-[rgba(255,255,255,0.04)] shrink-0">
                                        <form onSubmit={handleSearch} className="relative">
                                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
                                                placeholder="Semantic + keyword search…"
                                                className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-accent transition-colors placeholder:text-text-secondary/50" />
                                            <Search size={12} className="absolute left-2.5 top-2.5 text-text-secondary" />
                                        </form>
                                    </div>
                                    <div className="flex-1 p-2 overflow-y-auto space-y-1.5">
                                        {isSearching
                                            ? <div className="flex items-center justify-center p-6 text-text-secondary gap-2 text-xs"><Loader2 size={14} className="animate-spin text-accent" />Searching…</div>
                                            : searchResults.length > 0
                                                ? searchResults.map((r, i) => {
                                                    const fn = r.filePath.split(/[/\\]/).pop() || r.filePath;
                                                    const pinned = activeSession?.manualContext?.includes(r.filePath);
                                                    return (
                                                        <div key={i} className="p-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)] hover:bg-[rgba(255,255,255,0.04)] hover:border-accent/30 transition-all group">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 flex-1 truncate cursor-pointer" onClick={() => handleOpenFile(r.filePath, r.lineRangeStart)}>
                                                                    <FileText size={12} className="text-accent shrink-0" />
                                                                    <span className="truncate text-xs font-medium text-text-primary">{fn}</span>
                                                                    {r.lineRangeStart && <span className="text-[9px] text-text-secondary/50 shrink-0">:{r.lineRangeStart}</span>}
                                                                </div>
                                                                <button onClick={() => pinned ? handleUnpinFile(r.filePath) : handlePinFile(r.filePath)}
                                                                    className={`shrink-0 p-1.5 rounded transition-colors ${pinned ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-white hover:bg-[rgba(255,255,255,0.1)]'}`}>
                                                                    {pinned ? <X size={10} /> : <Plus size={10} />}
                                                                </button>
                                                            </div>
                                                            {r.snippet && <p className="mt-1.5 text-[10px] text-text-secondary font-mono leading-relaxed line-clamp-2 opacity-60">{r.snippet}</p>}
                                                        </div>
                                                    );
                                                })
                                                : <div className="text-center p-6 text-text-secondary text-xs opacity-50">Enter a concept or function name to search.</div>
                                        }
                                    </div>
                                </>
                            )}

                            {/* File Tree Tab */}
                            {leftTab === 'files' && (
                                <div className="flex-1 p-2 overflow-y-auto">
                                    {!treeLoaded
                                        ? <div className="flex items-center justify-center p-6 gap-2 text-text-secondary text-xs"><Loader2 size={13} className="animate-spin" />Loading tree…</div>
                                        : <FileTree nodes={fileTree} pinnedFiles={activeSession?.manualContext} onPinFile={handlePinFile} onOpenFile={handleOpenFile} />
                                    }
                                </div>
                            )}

                            {/* Context (Active Files) Tab */}
                            {leftTab === 'active' && (
                                <div className="flex-1 p-3 overflow-y-auto space-y-4">
                                    <div>
                                        <div className="text-[9px] font-bold tracking-widest text-text-secondary uppercase mb-2 flex items-center gap-1">
                                            <Pin size={9} className="text-accent" />High Priority (Pinned)
                                        </div>
                                        {(!activeSession?.manualContext?.length)
                                            ? <div className="text-xs text-text-secondary/40 pl-1">No files pinned yet.</div>
                                            : activeSession.manualContext.map(fp => {
                                                const fn = fp.split(/[/\\]/).pop() || fp;
                                                return (
                                                    <div key={fp} className="flex items-center justify-between p-2 mb-1 rounded bg-accent/5 border border-accent/15">
                                                        <div className="flex items-center gap-2 truncate cursor-pointer hover:text-accent transition-colors" onClick={() => handleOpenFile(fp)}>
                                                            <FileText size={11} className="text-accent/70 shrink-0" />
                                                            <span className="truncate text-[11px]">{fn}</span>
                                                        </div>
                                                        <button onClick={() => handleUnpinFile(fp)} className="shrink-0 p-1 text-text-secondary hover:text-red-400 transition-colors"><X size={11} /></button>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold tracking-widest text-text-secondary uppercase mb-2 flex items-center gap-1">
                                            <Search size={9} />Secondary (Auto)
                                        </div>
                                        {(() => {
                                            const last = activeSession?.messages.slice().reverse().find(m => m.role === 'assistant');
                                            const pinned = activeSession?.manualContext || [];
                                            const auto = (last?.citations || []).filter(c => !pinned.includes(c));
                                            const refs = (last?.citationRefs || []).filter(r => !pinned.includes(r.filePath));
                                            if (!auto.length) return <div className="text-xs text-text-secondary/40 pl-1">Ask a question to see retrieved files.</div>;
                                            return auto.map(fp => {
                                                const fn = fp.split(/[/\\]/).pop() || fp;
                                                const ref = refs.find(r => r.filePath === fp);
                                                return (
                                                    <div key={fp} className="flex items-center justify-between p-2 mb-1 rounded hover:bg-bg-surface-active transition-colors">
                                                        <div className="flex items-center gap-2 truncate cursor-pointer hover:text-accent" onClick={() => handleOpenFile(fp, ref?.lineRangeStart)}>
                                                            <FileText size={11} className="text-text-secondary/50 shrink-0" />
                                                            <span className="truncate text-[11px] text-text-secondary">{fn}</span>
                                                            {ref?.lineRangeStart && <span className="text-[9px] text-text-secondary/40">:{ref.lineRangeStart}</span>}
                                                        </div>
                                                        <button onClick={() => handlePinFile(fp)} className="shrink-0 p-1 text-text-secondary hover:text-accent transition-colors" title="Promote to pinned"><Plus size={11} /></button>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </section>
                    </Panel>
                )}

                {!zenMode && <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors cursor-col-resize border-l border-r border-transparent" />}

                {/* Chat Panel */}
                <Panel id="chat-main" order={2} minSize={35}>
                    <main className={`h-full bg-bg-main flex flex-col relative overflow-hidden ${zenMode ? 'mx-auto' : ''}`} style={zenMode ? { width: '100%', maxWidth: '1200px' } : { width: '100%' }}>
                        {/* Header */}
                        <header className="px-5 py-3 border-b border-glass-border flex items-center justify-between bg-bg-main/80 backdrop-blur-md shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/30 to-accent/5 flex items-center justify-center border border-accent/20">
                                    <Bot size={14} className="text-accent" />
                                </div>
                                <span className="text-sm font-semibold">{activeSession?.title || 'Atlas Chat'}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-border-subtle shadow-sm">{model}</span>
                                {/* Persona Selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowPersonaPicker(v => !v)}
                                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${activePersona !== 'default'
                                            ? 'bg-accent/10 border-accent/40 text-accent'
                                            : 'bg-bg-elevated border-border-subtle text-text-secondary hover:border-accent/30'
                                            }`}
                                        data-tooltip="Switch Persona"
                                        title=""
                                    >
                                        <span>{getPersona(activePersona).icon}</span>
                                        <span className="hidden sm:inline">{getPersona(activePersona).name}</span>
                                    </button>
                                    {showPersonaPicker && (
                                        <div className="absolute top-full left-0 mt-1.5 z-50 w-56 bg-[#0f1520]/80 backdrop-blur-xl border border-glass-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            {PERSONAS.map((p: Persona) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => { setActivePersona(p.id); setShowPersonaPicker(false); toast(`Persona: ${p.name}`, 'info'); }}
                                                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs transition-colors ${activePersona === p.id
                                                        ? 'bg-accent/10 text-accent'
                                                        : 'text-text-secondary hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary'
                                                        }`}
                                                >
                                                    <span className="text-sm">{p.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium">{p.name}</div>
                                                        <div className="text-[9px] opacity-50 truncate">{p.description}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={toggleZenMode} data-tooltip={zenMode ? 'Exit Zen Mode (Ctrl+J)' : 'Zen Mode (Ctrl+J)'} className={`p-2 hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors ${zenMode ? 'text-accent' : 'text-text-secondary'}`} title="">
                                    {zenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                </button>
                                <button onClick={handleExportChat} data-tooltip="Export as Markdown" className="p-2 text-text-secondary hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors" title=""><Download size={14} /></button>
                                <button onClick={() => setShowSettings(true)} data-tooltip="Settings (Ctrl+,)" className="p-2 text-text-secondary hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors" title=""><Settings size={14} /></button>
                            </div>
                        </header>

                        {/* Messages */}
                        <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-5 space-y-5">
                            {!activeSession || activeSession.messages.length === 0
                                ? (
                                    <div className="h-full flex flex-col items-center justify-center text-text-secondary space-y-6 animate-in fade-in duration-700">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center shadow-lg shadow-accent/5">
                                            <Bot size={32} className="text-accent opacity-80" />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-medium text-text-primary">Welcome to Atlas</h2>
                                            <p className="text-sm max-w-sm text-center opacity-70">Your personal AI-first workspace. Ask anything about your codebase, or start with a quick action below.</p>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-center gap-2 max-w-md pt-4">
                                            {[
                                                { icon: <RefreshCcw size={12} />, text: "Summarize recent changes", query: "Summarize the recent changes made to this workspace." },
                                                { icon: <Search size={12} />, text: "Find security issues", query: "Can you scan this workspace for any obvious security vulnerabilities?" },
                                                { icon: <FileText size={12} />, text: "Explain the architecture", query: "Explain the high-level architecture of this project." }
                                            ].map((action, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSubmitChat(undefined, action.query)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-glass-bg border border-glass-border hover:border-accent/40 hover:bg-accent/5 text-xs text-text-secondary hover:text-text-primary transition-all animate-in fade-in slide-in-from-bottom flex-shrink-0"
                                                    style={{ animationDelay: `${150 * (i + 1)}ms` }}
                                                >
                                                    <span className="text-accent">{action.icon}</span>
                                                    {action.text}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="text-[10px] text-text-secondary/40 space-y-1 mt-8 text-center bg-bg-surface px-4 py-2 rounded-lg border border-border-subtle">
                                            <p><kbd className="font-mono bg-bg-inset px-1 py-0.5 rounded border border-border-default">Ctrl+K</kbd> Command Palette &nbsp;·&nbsp; <kbd className="font-mono bg-bg-inset px-1 py-0.5 rounded border border-border-default">Ctrl+,</kbd> Settings</p>
                                            <p><kbd className="font-mono bg-bg-inset px-1 py-0.5 rounded border border-border-default">Ctrl+F</kbd> Search Files &nbsp;·&nbsp; <kbd className="font-mono bg-bg-inset px-1 py-0.5 rounded border border-border-default">Ctrl+J</kbd> Zen Mode</p>
                                        </div>
                                    </div>
                                )
                                : activeSession.messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 relative group`}>
                                        {/* Branch Button */}
                                        {!isGenerating && msg.role === 'user' && (
                                            <button
                                                onClick={() => handleBranchChat(i)}
                                                className="absolute right-[90%] top-1/2 -translate-y-1/2 p-2 text-text-secondary/0 group-hover:text-text-secondary/50 hover:!text-accent transition-all duration-200"
                                                data-tooltip="Branch chat from here"
                                                title=""
                                            >
                                                <GitBranch size={14} />
                                            </button>
                                        )}

                                        <div className={`max-w-[88%] rounded-2xl p-5 shadow-sm ${msg.role === 'user'
                                            ? 'bg-accent-muted border border-accent/20'
                                            : 'bg-glass-bg border border-glass-border'}`}>
                                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                                {(isGenerating && i === activeSession.messages.length - 1) && (
                                                    <span className="inline-block w-1.5 h-3.5 bg-accent ml-1 animate-pulse align-middle opacity-80"></span>
                                                )}
                                            </div>

                                            {/* Citations */}
                                            {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-border-subtle">
                                                    <div className="text-[9px] text-text-secondary mb-2 font-bold uppercase tracking-widest">Sources</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {msg.citations.map((cite, j) => {
                                                            const fn = cite.split(/[/\\]/).pop() || cite;
                                                            const ref = msg.citationRefs?.find(r => r.filePath === cite);
                                                            return (
                                                                <button key={j} onClick={() => handleOpenFile(cite, ref?.lineRangeStart)}
                                                                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] hover:border-accent/50 hover:text-accent transition-all"
                                                                    title={cite}>
                                                                    <FileText size={9} />{fn}{ref?.lineRangeStart ? `:${ref.lineRangeStart}` : ''}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Follow-up suggestions */}
                                            {msg.role === 'assistant' && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                                                    <div className="text-[9px] text-text-secondary mb-2 font-bold uppercase tracking-widest">Follow-up</div>
                                                    <div className="flex flex-col gap-1.5">
                                                        {msg.followUpSuggestions.map((q, j) => (
                                                            <button key={j} onClick={() => handleSubmitChat(undefined, q)}
                                                                disabled={isGenerating}
                                                                className="text-left text-xs text-text-secondary hover:text-accent border border-[rgba(255,255,255,0.06)] hover:border-accent/40 px-3 py-1.5 rounded-lg transition-all hover:bg-accent/5 disabled:opacity-40">
                                                                {q}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            }
                            <div ref={messagesEndRef} />
                        </div>

                        {showScrollButton && (
                            <button
                                onClick={handleScrollToBottom}
                                className="absolute bottom-36 left-1/2 -translate-x-1/2 p-2 rounded-full bg-accent text-bg-main shadow-lg hover:bg-accent/80 transition-all z-10 animate-in fade-in slide-in-from-bottom-2"
                                title="Scroll to bottom"
                            >
                                <ArrowDown size={14} />
                            </button>
                        )}

                        {/* Input */}
                        <div className="p-4 shrink-0">
                            <div className="border border-border-default rounded-xl bg-bg-elevated/60 backdrop-blur-md focus-within:border-accent/50 focus-within:shadow-2xl focus-within:shadow-accent/5 transition-all duration-300 flex flex-col shadow-lg">
                                {/* Context bar */}
                                <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-2 overflow-x-auto min-h-[36px]">
                                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap">Ctx:</span>
                                    {activeSession?.manualContext?.length
                                        ? activeSession.manualContext.map(fp => {
                                            const fn = fp.split(/[/\\]/).pop() || fp;
                                            return (
                                                <div key={fp} className="flex items-center gap-1 bg-accent/15 border border-accent/35 rounded px-1.5 py-0.5 whitespace-nowrap text-[10px]">
                                                    <FileText size={9} className="text-accent" />
                                                    <span className="max-w-[110px] truncate">{fn}</span>
                                                    <button onClick={() => handleUnpinFile(fp)} className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"><X size={9} /></button>
                                                </div>
                                            );
                                        })
                                        : <span className="text-[10px] text-text-secondary/40 italic">Auto Retrieval</span>
                                    }
                                    <button onClick={() => setLeftTab('search')} className="flex items-center gap-1 text-[9px] ml-auto shrink-0 text-text-secondary hover:text-white bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)] rounded px-2 py-1 transition-colors">
                                        <Plus size={9} /> Add Files
                                    </button>
                                </div>

                                {/* Image Preview Row */}
                                {attachedImages.length > 0 && (
                                    <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                                        {attachedImages.map((img, idx) => (
                                            <div key={idx} className="relative group/img w-16 h-16 rounded-lg border border-glass-border overflow-hidden shadow-sm">
                                                <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => handleRemoveImage(idx)}
                                                    className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <textarea
                                    id="chat-input"
                                    value={inputQuery}
                                    onChange={handleTextareaInput}
                                    onKeyDown={handleKeyDown}
                                    disabled={isGenerating}
                                    className="w-full bg-transparent resize-none px-4 pt-3 pb-1 text-sm focus:outline-none placeholder:text-text-secondary/50 min-h-[72px] max-h-[220px] leading-relaxed disabled:opacity-50"
                                    placeholder="Ask about your codebase… (Enter to send, Shift+Enter for newline)"
                                />

                                <div className="px-4 py-2.5 border-t border-border-subtle flex justify-between items-center bg-bg-inset rounded-b-xl">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={imageInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => imageInputRef.current?.click()}
                                            disabled={isGenerating}
                                            className="p-1.5 text-text-secondary hover:text-accent transition-colors disabled:opacity-30"
                                            data-tooltip="Attach Images"
                                            title=""
                                        >
                                            <ImageIcon size={14} />
                                        </button>
                                        <span className="text-[9px] text-text-secondary/60 font-bold tracking-widest uppercase">{workspace.name}</span>
                                        <ModelSelector
                                            value={overrideModel}
                                            onChange={setOverrideModel}
                                            availableModels={availableModels}
                                            defaultModel={model}
                                            provider={provider}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isGenerating && (
                                            <button onClick={handleStop} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all">
                                                <StopCircle size={12} />Stop
                                            </button>
                                        )}
                                        <button onClick={() => handleTimeline(24)} disabled={isGenerating} className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all duration-200 ${isGenerating ? 'bg-bg-surface-active text-text-muted cursor-not-allowed' : 'bg-green-500 text-bg-main hover:opacity-90 active:scale-95 shadow-md'}`}>
                                            {isGenerating ? <><Loader2 size={12} className="animate-spin" />Processing</> : <>Timeline<Send size={12} /></>}
                                        </button>
                                        <button onClick={() => handleSubmitChat()} disabled={!inputQuery.trim() || isGenerating}
                                            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all duration-200 ${!inputQuery.trim() || isGenerating ? 'bg-bg-surface-active text-text-muted cursor-not-allowed' : 'bg-text-primary text-bg-main hover:opacity-90 active:scale-95 shadow-md'}`}>
                                            {isGenerating ? <><Loader2 size={12} className="animate-spin" />Thinking</> : <>Send<Send size={12} /></>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </Panel>
            </PanelGroup>
        </div>
    );
}
