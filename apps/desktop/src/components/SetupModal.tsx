import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Download, RefreshCw, ExternalLink } from 'lucide-react';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

const API = 'http://127.0.0.1:47291/api';

type setupStep = 'welcome' | 'dependencies' | 'workspace' | 'done';

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
    const [step, setStep] = useState<setupStep>('welcome');
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

    const handlePickFolder = async () => {
        try {
            const selected = await openDialog({
                directory: true,
                multiple: false,
                title: 'Select a Project to Index'
            });
            if (selected) {
                // In a real flow we'd call the indexing command here
                // For this wizard, we'll just dismiss and let the landing screen handle it
                // or we could trigger the same logic as LandingScreen.
                onDismiss();
            }
        } catch (err) {
            console.error('Folder picker error:', err);
        }
    };

    const renderWelcome = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/10 border border-white/5 flex items-center justify-center overflow-hidden">
                <div className="relative">
                    <div className="absolute inset-0 blur-2xl bg-accent/20 rounded-full animate-pulse" />
                    <span className="text-4xl relative">🏔️</span>
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">Welcome to Atlas</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    Atlas is your local-first AI coding companion. Let's get everything ready for your first workspace.
                </p>
            </div>
            <button
                onClick={() => setStep('dependencies')}
                className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 group"
            >
                Get Started
                <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
        </div>
    );

    const renderDependencies = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Environment Check</h3>
                <p className="text-xs text-text-secondary">We need Ollama and the Llama 3.2 model installed.</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-1 divide-y divide-white/5">
                {checking && !status ? (
                    <div className="flex items-center gap-2 text-text-secondary text-xs px-4 py-4">
                        <Loader2 size={14} className="animate-spin" /> Verifying environment…
                    </div>
                ) : status && (
                    <>
                        <StatusRow ok={status.ollamaOk} label="Ollama is running">
                            <button
                                onClick={() => openShell('https://ollama.com/download').catch(console.error)}
                                className="text-[10px] font-medium px-2 py-1 rounded bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all"
                            >
                                Get Ollama
                            </button>
                        </StatusRow>
                        {status.models.map(m => (
                            <ModelRow key={m.name} model={m} onPulled={check} />
                        ))}
                    </>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => setStep('welcome')}
                    className="flex-1 py-2 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                >
                    Back
                </button>
                <button
                    disabled={!allGood}
                    onClick={() => setStep('workspace')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${allGood ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary cursor-not-allowed'}`}
                >
                    Continue
                </button>
            </div>
        </div>
    );

    const renderWorkspace = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Your First Workspace</h3>
                <p className="text-xs text-text-secondary">Select a folder to index. You can always add more later.</p>
            </div>
            <div className="aspect-square w-full rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 bg-white/[0.01]">
                <div className="w-12 h-12 rounded-full bg-accent/5 flex items-center justify-center text-accent">
                    <Download size={24} />
                </div>
                <p className="text-xs text-text-secondary text-center px-8">
                    Select your project folder to start the indexing process.
                </p>
                <button
                    onClick={handlePickFolder}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-medium border border-white/10 transition-all"
                >
                    Select Folder
                </button>
            </div>
            <p className="text-[10px] text-text-secondary/50 text-center">
                Indexing happens entirely on your machine. No code leaves your system.
            </p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[#0a0c10] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="p-6">
                    {step === 'welcome' && renderWelcome()}
                    {step === 'dependencies' && renderDependencies()}
                    {step === 'workspace' && renderWorkspace()}
                </div>
                <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {(['welcome', 'dependencies', 'workspace'] as setupStep[]).map(s => (
                            <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${step === s ? 'bg-accent w-4' : 'bg-white/10'}`} />
                        ))}
                    </div>
                    <button onClick={onDismiss} className="text-[10px] text-text-secondary hover:text-white transition-colors lowercase">
                        Skip Onboarding
                    </button>
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
        // Persistence: Use localStorage for V1 so it doesn't show up every launch
        const dismissed = localStorage.getItem(SETUP_KEY);
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
        localStorage.setItem(SETUP_KEY, '1');
        setShow(false);
    };

    return { show, dismiss };
}
