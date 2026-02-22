import { useState, useEffect, useRef } from 'react';
import {
    Settings, X, AlertTriangle, RefreshCw, Info,
    Eye, EyeOff, Loader2, ChevronDown, ChevronRight,
    Cpu, ExternalLink, CheckCircle2, Zap,
} from 'lucide-react';

export type LLMProvider = 'ollama' | 'openrouter';

export interface AtlasSettings {
    model: string;
    provider: LLMProvider;
    openRouterApiKey: string;
    ollamaHost: string;
    backendUrl: string;
    contextSlots: number;
    systemPrompt: string;
}

export const DEFAULT_SETTINGS: AtlasSettings = {
    model: 'llama3.2:latest',
    provider: 'ollama',
    openRouterApiKey: '',
    ollamaHost: 'http://127.0.0.1:11434',
    backendUrl: 'http://127.0.0.1:47291',
    contextSlots: 8,
    systemPrompt: '',
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
    backendUrl: string;
    apiKey: string;
    selectedModel: string;
    onSelect: (id: string) => void;
}

function OpenRouterModelBrowser({ backendUrl, apiKey, selectedModel, onSelect }: ModelBrowserProps) {
    const [freeModels, setFreeModels] = useState<OpenRouterModel[]>([]);
    const [paidModels, setPaidModels] = useState<OpenRouterModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPaid, setShowPaid] = useState(false);
    const [paidSearch, setPaidSearch] = useState('');
    const [fetched, setFetched] = useState(false);

    const fetchModels = async () => {
        setLoading(true);
        setError('');
        try {
            const qs = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';
            const res = await fetch(`${backendUrl}/api/openrouter-models${qs}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as { free: OpenRouterModel[]; paid: OpenRouterModel[] };
            setFreeModels(data.free);
            setPaidModels(data.paid);
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
                    onClick={fetchModels}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {loading ? 'Loading models…' : 'Load OpenRouter Models'}
                </button>
            ) : (
                <button
                    onClick={fetchModels}
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
    const [draft, setDraft] = useState<AtlasSettings>({ ...settings });
    const [showKey, setShowKey] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
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
                className="bg-[#0f1520] border border-glass-border rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto p-6 space-y-5"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div id="settings-title" className="flex items-center gap-2 font-semibold text-white">
                        <Settings size={17} className="text-accent" aria-hidden="true" />
                        Settings
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        className="p-1 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                <div className="space-y-5 text-sm">

                    {/* ── Provider selector ─────────────────────────────── */}
                    <div className="space-y-2">
                        <label className="label-sm flex items-center gap-2">
                            <Cpu size={11} aria-hidden="true" />
                            LLM Provider
                        </label>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="LLM provider selection">
                            {(['ollama', 'openrouter'] as LLMProvider[]).map(p => (
                                <button
                                    key={p}
                                    role="radio"
                                    aria-checked={draft.provider === p}
                                    onClick={() => set('provider', p)}
                                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-accent/60 ${draft.provider === p
                                        ? 'border-accent/60 bg-accent/10 text-accent'
                                        : 'border-glass-border text-text-secondary hover:border-accent/30 hover:text-text-primary'
                                        }`}
                                >
                                    {p === 'ollama' ? '🦙 Ollama (Local)' : '🌐 OpenRouter'}
                                </button>
                            ))}
                        </div>
                        {!isOllama && (
                            <p className="text-[10px] text-amber-400/70 flex items-start gap-1 mt-1">
                                <AlertTriangle size={10} className="shrink-0 mt-0.5" aria-hidden="true" />
                                OpenRouter sends data to external servers. Your API key and queries leave your machine.{' '}
                                <a
                                    href="https://openrouter.ai/keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-amber-300 inline-flex items-center gap-0.5"
                                >
                                    Get a key <ExternalLink size={9} />
                                </a>
                            </p>
                        )}
                    </div>

                    {/* ── OpenRouter API Key ────────────────────────────── */}
                    {!isOllama && (
                        <div>
                            <label htmlFor="setting-api-key" className="label-sm">
                                OpenRouter API Key
                            </label>
                            <div className="relative">
                                <input
                                    id="setting-api-key"
                                    type={showKey ? 'text' : 'password'}
                                    value={draft.openRouterApiKey}
                                    onChange={e => set('openRouterApiKey', e.target.value)}
                                    placeholder="sk-or-v1-…"
                                    className="input-field pr-9 font-mono text-xs"
                                    autoComplete="off"
                                    aria-describedby="api-key-hint"
                                    spellCheck={false}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors focus:outline-none"
                                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                                >
                                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            <p id="api-key-hint" className="text-[10px] text-text-secondary/50 mt-1">
                                Stored only in your browser's localStorage — never sent to any Atlas server.
                                Free-tier models work without a key.
                            </p>
                        </div>
                    )}

                    {/* ── Model selection ───────────────────────────────── */}
                    <div>
                        <label htmlFor="setting-model" className="label-sm flex items-center gap-1.5">
                            <Cpu size={11} aria-hidden="true" />
                            {isOllama ? 'Ollama Model' : 'OpenRouter Model'}
                        </label>

                        {isOllama ? (
                            <>
                                <input
                                    id="setting-model"
                                    type="text"
                                    value={draft.model}
                                    onChange={e => set('model', e.target.value)}
                                    className="input-field"
                                    placeholder="llama3.2, mistral, deepseek-coder…"
                                    aria-describedby={showOllamaModelWarning ? 'model-warning' : 'model-hint'}
                                />
                                {showOllamaModelWarning ? (
                                    <div id="model-warning" role="alert" className="flex items-start gap-1.5 mt-1.5 text-[11px] text-amber-400/80">
                                        <AlertTriangle size={11} className="shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>
                                            <strong>{draft.model}</strong> is not a recognised model. Ensure it's installed:{' '}
                                            <code className="bg-white/10 px-1 rounded font-mono">ollama pull {draft.model}</code>
                                        </span>
                                    </div>
                                ) : (
                                    <p id="model-hint" className="text-[10px] text-text-secondary/50 mt-1">
                                        Must be installed locally via <code className="font-mono bg-white/10 px-1 rounded">ollama pull &lt;model&gt;</code>
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Show selected model name as a read-only badge */}
                                {draft.model && (
                                    <div className="mb-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-accent/30 bg-accent/5 text-accent">
                                        <CheckCircle2 size={12} aria-hidden="true" />
                                        <span className="font-mono truncate">{draft.model}</span>
                                        <button
                                            onClick={() => set('model', '')}
                                            className="ml-auto shrink-0 text-text-secondary hover:text-red-400 transition-colors"
                                            aria-label="Clear selected model"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                )}
                                <OpenRouterModelBrowser
                                    backendUrl={draft.backendUrl}
                                    apiKey={draft.openRouterApiKey}
                                    selectedModel={draft.model}
                                    onSelect={id => set('model', id)}
                                />
                            </>
                        )}
                    </div>

                    {/* ── Connection settings ───────────────────────────── */}
                    {isOllama && (
                        <div>
                            <label htmlFor="setting-ollama-host" className="label-sm">Ollama Host</label>
                            <input
                                id="setting-ollama-host"
                                type="url"
                                value={draft.ollamaHost}
                                onChange={e => set('ollamaHost', e.target.value)}
                                className="input-field"
                                aria-describedby="ollama-host-hint"
                            />
                            <p id="ollama-host-hint" className="text-[10px] text-text-secondary/50 mt-1">
                                Default: http://127.0.0.1:11434
                            </p>
                        </div>
                    )}
                    <div>
                        <label htmlFor="setting-backend-url" className="label-sm">Atlas Backend URL</label>
                        <input
                            id="setting-backend-url"
                            type="url"
                            value={draft.backendUrl}
                            onChange={e => set('backendUrl', e.target.value)}
                            className="input-field"
                        />
                    </div>

                    {/* ── Context slots ─────────────────────────────────── */}
                    <div>
                        <label htmlFor="setting-context-slots" className="label-sm">
                            RAG Context Slots —{' '}
                            <span className="text-accent font-bold" aria-live="polite">{draft.contextSlots}</span>
                        </label>
                        <input
                            id="setting-context-slots"
                            type="range"
                            min={4}
                            max={16}
                            step={1}
                            value={draft.contextSlots}
                            onChange={e => set('contextSlots', parseInt(e.target.value))}
                            className="w-full accent-[#5FA8FF] mt-1"
                            aria-valuemin={4}
                            aria-valuemax={16}
                            aria-valuenow={draft.contextSlots}
                        />
                        <div className="flex justify-between text-[10px] text-text-secondary" aria-hidden="true">
                            <span>4 (faster)</span><span>16 (more context)</span>
                        </div>
                    </div>

                    {/* ── System prompt ─────────────────────────────────── */}
                    <div>
                        <label htmlFor="setting-system-prompt" className="label-sm">Custom System Prompt</label>
                        <textarea
                            id="setting-system-prompt"
                            value={draft.systemPrompt}
                            onChange={e => set('systemPrompt', e.target.value)}
                            rows={3}
                            placeholder="Always respond in TypeScript. Prefer concise answers."
                            className="input-field resize-none"
                        />
                        <p className="text-[10px] text-text-secondary/50 mt-1">
                            Prepended to every RAG prompt before your question.
                        </p>
                    </div>

                    {/* ── Index stats & re-index ────────────────────────── */}
                    <div className="pt-2 border-t border-glass-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs font-medium text-text-secondary flex items-center gap-1">
                                    <Info size={11} aria-hidden="true" />Indexed Chunks
                                </div>
                                <div className="text-lg font-bold text-accent mt-0.5">
                                    {indexedChunks?.toLocaleString() ?? '—'}
                                </div>
                            </div>
                            <button
                                onClick={onReindex}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60"
                                aria-label="Re-index the current workspace"
                            >
                                <RefreshCw size={11} aria-hidden="true" />
                                Re-index Workspace
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => { onSave(draft); onClose(); }}
                        className="flex-1 bg-white text-black font-bold text-sm py-2 rounded-lg hover:bg-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                        Save Changes
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-glass-border text-text-secondary hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
