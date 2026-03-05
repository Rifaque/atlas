import { useState, useEffect, useRef } from 'react';
import {
    Settings, X, AlertTriangle, RefreshCw,
    Eye, EyeOff, Loader2, ChevronDown, ChevronRight,
    Cpu, CheckCircle2, Zap, Globe,
} from 'lucide-react';
import { fetchOpenRouterModels as fetchOrModels } from '../lib/api';

export type LLMProvider = 'ollama' | 'openrouter';

export interface AtlasSettings {
    model: string;
    provider: LLMProvider;
    openRouterApiKey: string;
    ollamaHost: string;
    backendUrl: string;
    contextSlots: number;
    systemPrompt: string;
    webSearchEnabled: boolean;
    webSearchProvider: 'tavily' | 'serper';
    webSearchApiKey: string;
}

export const DEFAULT_SETTINGS: AtlasSettings = {
    model: 'llama3.2:latest',
    provider: 'ollama',
    openRouterApiKey: '',
    ollamaHost: 'http://127.0.0.1:11434',
    backendUrl: 'http://127.0.0.1:47291',
    contextSlots: 8,
    systemPrompt: '',
    webSearchEnabled: false,
    webSearchProvider: 'tavily',
    webSearchApiKey: '',
};

export function loadSettings(): AtlasSettings {
    try {
        const raw = localStorage.getItem('atlas_settings');
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { }
    return DEFAULT_SETTINGS;
}

export function persistSettings(s: AtlasSettings) {
    localStorage.setItem('atlas_settings', JSON.stringify(s));
}

// rag types copied over so we don't get circular imports
interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    pricing: { prompt: string; completion: string };
    context_length: number;
    isFree: boolean;
}

// models that we know work well with ollama
const KNOWN_OLLAMA_MODELS = [
    'llama3', 'llama3:8b', 'llama3:70b',
    'llama3.1', 'llama3.1:8b', 'llama3.2', 'llama3.2:latest', 'llama3.2:3b',
    'codellama', 'codellama:7b', 'codellama:13b', 'codellama:34b',
    'mistral', 'mistral:7b', 'mixtral', 'mixtral:8x7b',
    'deepseek-coder', 'deepseek-coder:6.7b', 'deepseek-coder:33b',
    'qwen2.5-coder', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b',
    'gemma2', 'gemma2:9b', 'gemma2:27b', 'phi3', 'phi3.5',
];

// openrouter model picker
interface ModelBrowserProps {
    apiKey: string;
    selectedModel: string;
    onSelect: (id: string) => void;
}

function OpenRouterModelBrowser({ apiKey, selectedModel, onSelect }: ModelBrowserProps) {
    const [freeModels, setFreeModels] = useState<OpenRouterModel[]>([]);
    const [paidModels, setPaidModels] = useState<OpenRouterModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPaid, setShowPaid] = useState(false);
    const [paidSearch, setPaidSearch] = useState('');
    const [fetched, setFetched] = useState(false);

    const loadModels = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchOrModels(apiKey);
            // Map string arrays to OpenRouterModel shape for display
            setFreeModels(data.free.map(id => ({ id, name: id, pricing: { prompt: '0', completion: '0' }, context_length: 0, isFree: true })));
            setPaidModels(data.paid.map(id => ({ id, name: id, pricing: { prompt: '?', completion: '?' }, context_length: 0, isFree: false })));
            setFetched(true);
        } catch (e: any) {
            setError(e.message || 'Failed to fetch models');
        } finally {
            setLoading(false);
        }
    };

    const filteredPaid = paidSearch.trim()
        ? paidModels.filter(m =>
            m.name.toLowerCase().includes(paidSearch.toLowerCase()) ||
            m.id.toLowerCase().includes(paidSearch.toLowerCase())
        )
        : paidModels;

    const ModelRow = ({ m }: { m: OpenRouterModel }) => {
        const selected = selectedModel === m.id;
        return (
            <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-start gap-2.5 group ${selected
                    ? 'border-accent/60 bg-accent/10 text-text-primary'
                    : 'border-glass-border hover:border-accent/30 hover:bg-[rgba(255,255,255,0.03)] text-text-secondary'
                    }`}
                aria-pressed={selected}
                title={m.description}
            >
                <div className="mt-0.5 shrink-0">
                    {selected
                        ? <CheckCircle2 size={13} className="text-accent" />
                        : <Cpu size={13} className="opacity-40 group-hover:opacity-70 transition-opacity" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium truncate">{m.name}</span>
                        {m.isFree && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">
                                FREE
                            </span>
                        )}
                    </div>
                    <div className="text-[9px] opacity-50 font-mono truncate mt-0.5">{m.id}</div>
                    {m.context_length > 0 && (
                        <div className="text-[9px] opacity-40 mt-0.5">
                            {(m.context_length / 1000).toFixed(0)}k ctx
                            {!m.isFree && ` · $${m.pricing.prompt}/tok`}
                        </div>
                    )}
                </div>
            </button>
        );
    };

    return (
        <div className="space-y-2">
            {!fetched ? (
                <button
                    onClick={loadModels}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {loading ? 'Loading models…' : 'Load OpenRouter Models'}
                </button>
            ) : (
                <button
                    onClick={loadModels}
                    disabled={loading}
                    className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-white transition-colors ml-auto"
                >
                    <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            )}

            {error && (
                <p className="text-xs text-red-400/80 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    {error}
                </p>
            )}

            {fetched && (
                <>
                    {/* Free models */}
                    <div>
                        <div className="text-[9px] font-bold tracking-widest uppercase text-green-400/70 mb-1.5 px-1">
                            Free Models ({freeModels.length})
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                            {freeModels.length > 0
                                ? freeModels.map(m => <ModelRow key={m.id} m={m} />)
                                : <p className="text-xs text-text-secondary/50 px-1">No free models found.</p>
                            }
                        </div>
                    </div>

                    {/* Paid models — collapsible with search */}
                    <div>
                        <button
                            onClick={() => setShowPaid(v => !v)}
                            className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-text-secondary/60 hover:text-text-secondary transition-colors px-1 py-1 w-full"
                        >
                            {showPaid ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            Paid Models ({paidModels.length}) — search to browse
                        </button>

                        {showPaid && (
                            <div className="space-y-1.5 mt-1">
                                <input
                                    type="text"
                                    value={paidSearch}
                                    onChange={e => setPaidSearch(e.target.value)}
                                    placeholder="Search paid models (e.g. claude, gpt, gemini)…"
                                    className="input-field text-xs py-1.5"
                                    aria-label="Search paid OpenRouter models"
                                />
                                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                                    {paidSearch.trim()
                                        ? filteredPaid.length > 0
                                            ? filteredPaid.slice(0, 30).map(m => <ModelRow key={m.id} m={m} />)
                                            : <p className="text-xs text-text-secondary/50 px-1">No results for "{paidSearch}".</p>
                                        : <p className="text-xs text-text-secondary/40 px-1 italic">Type to search {paidModels.length} paid models.</p>
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// the big settings modal

interface SettingsModalProps {
    settings: AtlasSettings;
    indexedChunks?: number;
    onSave: (s: AtlasSettings) => void;
    onReindex: () => void;
    onClose: () => void;
}

export function SettingsModal({ settings, indexedChunks, onSave, onReindex, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'models' | 'system'>('general');
    const [draft, setDraft] = useState<AtlasSettings>({ ...settings });
    const [showKey, setShowKey] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [optimizing, setOptimizing] = useState(false);

    const set = <K extends keyof AtlasSettings>(k: K, v: AtlasSettings[K]) =>
        setDraft(d => ({ ...d, [k]: v }));

    const isOllama = draft.provider === 'ollama';
    const showOllamaModelWarning = isOllama && draft.model.trim() !== '' &&
        !KNOWN_OLLAMA_MODELS.some(k => draft.model.toLowerCase().startsWith(k));

    // Keyboard trap + Esc close
    useEffect(() => {
        const el = modalRef.current;
        if (!el) return;
        const focusable = el.querySelectorAll<HTMLElement>(
            'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        focusable[0]?.focus();

        const handle = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab') return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
            else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
        };
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            role="presentation"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                className="bg-[#0f1520] border border-glass-border rounded-2xl shadow-2xl w-full max-w-[550px] max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header & Tabs */}
                <div className="border-b border-glass-border shrink-0 px-6 pt-5 pb-0">
                    <div className="flex items-center justify-between mb-4">
                        <div id="settings-title" className="flex items-center gap-2 font-semibold text-white">
                            <Settings size={17} className="text-accent" aria-hidden="true" />
                            Settings
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="flex gap-4">
                        {(['general', 'models', 'system'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors focus:outline-none ${activeTab === tab
                                    ? 'border-accent text-white'
                                    : 'border-transparent text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">

                    {/* ── GENERAL TAB ─────────────────────────────────── */}
                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Context Slots */}
                            <div>
                                <label className="label-sm">
                                    Knowledge Context Scope — <span className="text-accent font-bold" aria-live="polite">{draft.contextSlots}</span>
                                </label>
                                <input
                                    type="range"
                                    min={4} max={16} step={1}
                                    value={draft.contextSlots}
                                    onChange={e => set('contextSlots', parseInt(e.target.value))}
                                    className="w-full accent-[#5FA8FF] mt-1"
                                />
                                <div className="flex justify-between text-[10px] text-text-secondary mt-1">
                                    <span>Faster generation</span><span>Maximum context</span>
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div>
                                <label className="label-sm">Custom System Prompt</label>
                                <textarea
                                    value={draft.systemPrompt}
                                    onChange={e => set('systemPrompt', e.target.value)}
                                    rows={3}
                                    placeholder="Always respond in TypeScript. Prefer concise answers."
                                    className="input-field resize-none mt-1"
                                />
                                <p className="text-[10px] text-text-secondary/50 mt-1">
                                    Prepended to every prompt before your question.
                                </p>
                            </div>

                            {/* Web Search */}
                            <div className="space-y-3 pt-3 border-t border-glass-border">
                                <div className="flex items-center justify-between">
                                    <label className="label-sm flex items-center gap-1.5 focus:outline-none">
                                        <Globe size={13} className="text-accent" />
                                        Web Search Integration
                                    </label>
                                    <button
                                        onClick={() => set('webSearchEnabled', !draft.webSearchEnabled)}
                                        className={`relative w-9 h-5 rounded-full transition-colors focus:ring-2 focus:ring-accent/50 ${draft.webSearchEnabled ? 'bg-accent' : 'bg-glass-border'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${draft.webSearchEnabled ? 'translate-x-4' : ''}`} />
                                    </button>
                                </div>

                                {draft.webSearchEnabled && (
                                    <div className="space-y-3 bg-black/20 p-3 rounded-lg border border-glass-border">
                                        <div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(['tavily', 'serper'] as const).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => set('webSearchProvider', p)}
                                                        className={`py-2 px-2 rounded border text-xs font-medium transition-all ${draft.webSearchProvider === p
                                                            ? 'border-accent/60 bg-accent/10 text-accent'
                                                            : 'border-glass-border text-text-secondary hover:border-accent/30'
                                                            }`}
                                                    >
                                                        {p === 'tavily' ? '🔍 Tavily' : '🌐 Serper'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <input
                                                type="password"
                                                value={draft.webSearchApiKey}
                                                onChange={e => set('webSearchApiKey', e.target.value)}
                                                placeholder={draft.webSearchProvider === 'tavily' ? 'tvly-...' : 'serper key...'}
                                                className="input-field font-mono text-xs"
                                                spellCheck={false}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── MODELS TAB ─────────────────────────────────── */}
                    {activeTab === 'models' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-2">
                                {(['ollama', 'openrouter'] as LLMProvider[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => set('provider', p)}
                                        className={`py-3 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${draft.provider === p
                                            ? 'border-accent/60 bg-accent/10 text-accent shadow-[0_0_15px_rgba(95,168,255,0.1)]'
                                            : 'border-glass-border text-text-secondary hover:border-accent/30 hover:text-white'
                                            }`}
                                    >
                                        {p === 'ollama' ? '🦙 Ollama' : '🌐 OpenRouter'}
                                    </button>
                                ))}
                            </div>

                            {/* Provider configs */}
                            <div className="bg-black/20 p-4 rounded-xl border border-glass-border">
                                {isOllama ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="label-sm">Local Host URL</label>
                                            <input
                                                type="url"
                                                value={draft.ollamaHost}
                                                onChange={e => set('ollamaHost', e.target.value)}
                                                className="input-field mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="label-sm">Model Name</label>
                                            <input
                                                type="text"
                                                value={draft.model}
                                                onChange={e => set('model', e.target.value)}
                                                className="input-field mt-1 font-mono text-xs"
                                                placeholder="llama3.2:latest"
                                            />
                                        </div>
                                        {showOllamaModelWarning && (
                                            <div className="flex gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                                <span className="text-xs">Ensure this model is installed via <code className="bg-black/30 px-1 rounded">ollama pull {draft.model}</code></span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="label-sm">API Key</label>
                                            <div className="relative mt-1">
                                                <input
                                                    type={showKey ? 'text' : 'password'}
                                                    value={draft.openRouterApiKey}
                                                    onChange={e => set('openRouterApiKey', e.target.value)}
                                                    placeholder="sk-or-v1-…"
                                                    className="input-field pr-9 font-mono text-xs"
                                                />
                                                <button
                                                    onClick={() => setShowKey(!showKey)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"
                                                >
                                                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label-sm mb-2 block">Model Selection</label>
                                            {draft.model && (
                                                <div className="mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded border border-accent/20 bg-accent/5">
                                                    <CheckCircle2 size={12} className="text-accent" />
                                                    <span className="font-mono text-accent">{draft.model}</span>
                                                </div>
                                            )}
                                            <div className="bg-[#0b0f17] border border-glass-border rounded p-2 max-h-[250px] overflow-y-auto">
                                                <OpenRouterModelBrowser
                                                    apiKey={draft.openRouterApiKey}
                                                    selectedModel={draft.model}
                                                    onSelect={id => set('model', id)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── SYSTEM TAB ─────────────────────────────────── */}
                    {activeTab === 'system' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/30 rounded-xl p-4 border border-glass-border flex flex-col items-center justify-center text-center">
                                    <div className="text-text-secondary text-xs uppercase tracking-widest font-bold mb-1">Index Size</div>
                                    <div className="text-3xl font-light text-white">{indexedChunks?.toLocaleString() ?? '0'}</div>
                                    <div className="text-[10px] text-accent mt-1 bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">Vector Chunks</div>
                                </div>
                                <div className="bg-black/30 rounded-xl p-4 border border-glass-border flex flex-col items-center justify-center text-center">
                                    <div className="text-text-secondary text-xs uppercase tracking-widest font-bold mb-1">Database</div>
                                    <div className="text-xl font-light text-green-400">LanceDB</div>
                                    <div className="text-[10px] text-green-400/80 mt-1">Local embedded</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={onReindex}
                                    className="w-full flex items-center justify-between p-4 rounded-xl border border-glass-border hover:border-accent/40 hover:bg-white/5 transition-all group"
                                >
                                    <div className="text-left">
                                        <div className="font-semibold text-white flex items-center gap-2">
                                            <RefreshCw size={14} className="group-hover:text-accent transition-colors" />
                                            Re-index Workspace
                                        </div>
                                        <div className="text-xs text-text-secondary mt-1">Force a full re-scan of files. Useful if things get out of sync.</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        setOptimizing(true);
                                        setTimeout(() => setOptimizing(false), 2000); // Mock optimization trigger for now
                                    }}
                                    disabled={optimizing}
                                    className="w-full flex items-center justify-between p-4 rounded-xl border border-glass-border hover:border-amber-400/40 hover:bg-amber-400/5 transition-all group disabled:opacity-50"
                                >
                                    <div className="text-left">
                                        <div className="font-semibold text-white flex items-center gap-2">
                                            {optimizing ? (
                                                <Loader2 size={14} className="animate-spin text-amber-400" />
                                            ) : (
                                                <Zap size={14} className="group-hover:text-amber-400 transition-colors" />
                                            )}
                                            Optimize & Compress Vectors
                                        </div>
                                        <div className="text-xs text-text-secondary mt-1">Compress vectors (IVF-PQ) to reduce RAM usage and improve search speed.</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer actions */}
                <div className="flex gap-3 px-6 pb-6 pt-0 mt-auto shrink-0 border-t border-glass-border pt-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg border border-glass-border text-text-secondary hover:text-white text-sm font-medium transition-colors focus:outline-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onSave(draft); onClose(); }}
                        className="flex-1 bg-accent text-white font-bold text-sm py-2.5 rounded-lg hover:bg-accent/90 shadow-[0_0_15px_rgba(95,168,255,0.3)] transition-all focus:outline-none"
                    >
                        Apply Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
