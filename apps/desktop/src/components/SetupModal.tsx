import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Download, RefreshCw, ExternalLink } from 'lucide-react';
import { open as openShell } from '@tauri-apps/plugin-shell';

const API = 'http://127.0.0.1:47291/api';

interface ModelStatus { name: string; installed: boolean; }
interface SetupStatus {
    ollamaOk: boolean;
    models: ModelStatus[];
}

interface PullState {
    status: 'idle' | 'pulling' | 'done' | 'error';
    progress: string;
    percent: number;
}

function isAllGood(s: SetupStatus) {
    return s.ollamaOk && s.models.every(m => m.installed);
}

// a single status row
function StatusRow({ ok, label, children }: { ok: boolean; label: string; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-3 min-w-0">
                {ok
                    ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    : <XCircle size={18} className="text-red-400 shrink-0" />
                }
                <span className={`text-sm font-medium ${ok ? 'text-white' : 'text-red-300'}`}>{label}</span>
            </div>
            {!ok && children}
        </div>
    );
}

// row for downloading a model
function ModelRow({ model, onPulled }: { model: ModelStatus; onPulled: () => void }) {
    const [pull, setPull] = useState<PullState>({ status: 'idle', progress: '', percent: 0 });

    const startPull = async () => {
        setPull({ status: 'pulling', progress: 'Starting…', percent: 0 });
        try {
            const res = await fetch(`${API}/pull-model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model.name }),
            });
            if (!res.ok || !res.body) throw new Error('Pull request failed');

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value);
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    try {
                        const d = JSON.parse(line.slice(5).trim());
                        if (d.status === 'success') {
                            setPull({ status: 'done', progress: 'Installed!', percent: 100 });
                            onPulled();
                            return;
                        }
                        const pct = d.total ? Math.round((d.completed / d.total) * 100) : 0;
                        setPull({ status: 'pulling', progress: d.status || 'Downloading…', percent: pct });
                    } catch { /* skip */ }
                }
            }
            setPull(p => ({ ...p, status: 'done', percent: 100, progress: 'Done' }));
            onPulled();
        } catch (err: any) {
            setPull({ status: 'error', progress: err.message, percent: 0 });
        }
    };

    return (
        <div className="flex flex-col gap-1.5 py-3 border-b border-white/5 last:border-0">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {model.installed || pull.status === 'done'
                        ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                        : pull.status === 'pulling'
                            ? <Loader2 size={18} className="text-accent animate-spin shrink-0" />
                            : pull.status === 'error'
                                ? <XCircle size={18} className="text-red-400 shrink-0" />
                                : <XCircle size={18} className="text-red-400 shrink-0" />
                    }
                    <div>
                        <span className={`text-sm font-medium font-mono ${model.installed || pull.status === 'done' ? 'text-white' : 'text-red-300'}`}>
                            {model.name}
                        </span>
                        {pull.status === 'pulling' && pull.percent > 0 && (
                            <span className="ml-2 text-xs text-text-secondary">{pull.percent}%</span>
                        )}
                    </div>
                </div>
                {!model.installed && pull.status === 'idle' && (
                    <button
                        onClick={startPull}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-all shrink-0"
                    >
                        <Download size={12} /> Install
                    </button>
                )}
                {pull.status === 'error' && (
                    <button
                        onClick={startPull}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all shrink-0"
                    >
                        <RefreshCw size={12} /> Retry
                    </button>
                )}
            </div>

            {/* Progress bar */}
            {pull.status === 'pulling' && (
                <div className="ml-7 flex flex-col gap-1">
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-300"
                            style={{ width: `${pull.percent || 5}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-text-secondary">{pull.progress}</span>
                </div>
            )}
            {pull.status === 'error' && (
                <span className="ml-7 text-[10px] text-red-400">{pull.progress}</span>
            )}
        </div>
    );
}

// main setup component
export function SetupModal({ onDismiss }: { onDismiss: () => void }) {
    const [status, setStatus] = useState<SetupStatus | null>(null);
    const [checking, setChecking] = useState(true);

    const check = useCallback(async () => {
        setChecking(true);
        try {
            const res = await fetch(`${API}/setup-check`);
            if (res.ok) setStatus(await res.json());
        } catch { /* backend not ready yet */ }
        finally { setChecking(false); }
    }, []);

    useEffect(() => { check(); }, [check]);

    const allGood = status ? isAllGood(status) : false;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="px-6 py-5 border-b border-white/8">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                            <span className="text-lg">⚡</span>
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-white">Setup Check</h2>
                            <p className="text-xs text-text-secondary mt-0.5">Atlas needs a few things to work properly</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-4">
                    {checking && !status ? (
                        <div className="flex items-center gap-2 text-text-secondary text-sm py-4">
                            <Loader2 size={16} className="animate-spin" /> Checking dependencies…
                        </div>
                    ) : status ? (
                        <div>
                            {/* Ollama */}
                            <StatusRow ok={status.ollamaOk} label="Ollama is running">
                                <button
                                    onClick={() => openShell('https://ollama.com/download').catch(console.error)}
                                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-all shrink-0"
                                >
                                    <ExternalLink size={12} /> Download Ollama
                                </button>
                            </StatusRow>

                            {/* Models */}
                            {status.models.map(m => (
                                <ModelRow key={m.name} model={m} onPulled={check} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-red-400 py-4">Could not reach the Atlas backend. Make sure it is running.</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-3">
                    <button
                        onClick={check}
                        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-white transition-colors"
                    >
                        <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> Re-check
                    </button>
                    <div className="flex items-center gap-2">
                        {!allGood && (
                            <button
                                onClick={onDismiss}
                                className="text-xs text-text-secondary hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                Skip for now
                            </button>
                        )}
                        <button
                            onClick={onDismiss}
                            disabled={!allGood}
                            className={`text-xs font-semibold px-5 py-2 rounded-lg transition-all ${allGood
                                ? 'bg-accent text-white hover:bg-accent/80'
                                : 'bg-white/5 text-text-secondary cursor-not-allowed'
                                }`}
                        >
                            {allGood ? '✓ All set — Continue' : 'Continue'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// decide if we should show the setup modal
const SETUP_KEY = 'atlas_setup_dismissed';
export function useSetupModal(backendOnline: boolean) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!backendOnline) return;
        // Only show once per app session (not every launch after dismiss)
        const dismissed = sessionStorage.getItem(SETUP_KEY);
        if (dismissed) return;
        // Small delay so the app renders first
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/setup-check`);
                if (!res.ok) return;
                const data: SetupStatus = await res.json();
                if (!isAllGood(data)) setShow(true);
            } catch { /* silent */ }
        }, 800);
        return () => clearTimeout(t);
    }, [backendOnline]);

    const dismiss = () => {
        sessionStorage.setItem(SETUP_KEY, '1');
        setShow(false);
    };

    return { show, dismiss };
}
