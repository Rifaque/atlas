import { useState, useEffect } from 'react';
import { Button } from './Button';
import { GlassPanel } from './GlassPanel';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Cpu, Loader2, AlertCircle, CheckCircle, Plus, Trash2, ExternalLink } from 'lucide-react';
import { fetchModels, checkOllamaStatus, startIndexing } from '../lib/api';
import {
    loadWorkspaces, addOrUpdateWorkspace, removeWorkspace, setActiveWorkspaceId,
    type Workspace
} from '../lib/workspaces';
import { toast } from '../lib/toast';
import { SettingsModal, loadSettings, persistSettings, type AtlasSettings } from './SettingsModal';
import { Settings } from 'lucide-react';

interface LandingScreenProps {
    onIndexed: (ws: Workspace) => void;
}

export function LandingScreen({ onIndexed }: LandingScreenProps) {
    const [folderPath, setFolderPath] = useState<string | null>(null);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isOllamaRunning, setIsOllamaRunning] = useState<boolean | null>(null);
    const [isIndexing, setIsIndexing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('');
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [showNew, setShowNew] = useState(false);

    // Settings logic for Landing Screen
    const [settings, setSettings] = useState<AtlasSettings>(loadSettings());
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        setWorkspaces(loadWorkspaces());
        const init = async () => {
            const status = await checkOllamaStatus();
            const isOnline = status === 'online';
            setIsOllamaRunning(isOnline);

            if (settings.provider === 'openrouter') {
                try {
                    const orRes = await fetch(`${settings.backendUrl}/api/openrouter-models${settings.openRouterApiKey ? `?apiKey=${settings.openRouterApiKey}` : ''}`);
                    if (orRes.ok) {
                        const data = await orRes.json();
                        const ms = [...data.free, ...data.paid].map((m: any) => m.id);
                        setModels(ms);
                        if (ms.length > 0 && !selectedModel) setSelectedModel(ms[0]);
                    } else {
                        setModels([]);
                    }
                } catch {
                    setModels([]);
                }
            } else if (isOnline) {
                const ms = await fetchModels();
                setModels(ms);
                if (ms.length > 0) setSelectedModel(ms[0]);
            } else {
                setModels([]);
            }
        };
        init();
    }, [settings.provider, settings.backendUrl, settings.openRouterApiKey]);

    const selectFolder = async () => {
        if (isIndexing) return;
        try {
            const selected = await open({ directory: true, multiple: false });
            if (selected) setFolderPath(selected as string);
        } catch { }
    };

    const openWorkspace = (ws: Workspace) => {
        setActiveWorkspaceId(ws.id);
        onIndexed(ws);
    };

    const deleteWorkspace = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = removeWorkspace(id);
        setWorkspaces(next);
        toast('Workspace removed', 'info');
    };

    const handleInitialize = async () => {
        if (!folderPath || !selectedModel) return;
        setIsIndexing(true);
        setStatusMsg('Initializing indexing job...');
        setProgress(0);

        try {
            const jobId = await startIndexing(folderPath, selectedModel);
            const eventSource = new EventSource(`http://127.0.0.1:47291/api/index-progress/${jobId}`);

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.status === 'running') {
                    setStatusMsg(`Indexing files… (${data.processedFiles} processed, ${data.totalChunks} chunks)`);
                    setProgress(50); // Set to indeterminate-like state
                } else if (data.status === 'completed') {
                    setStatusMsg('Indexing complete!');
                    setProgress(100);
                    eventSource.close();
                    const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
                    const ws: Workspace = {
                        id: crypto.randomUUID(),
                        name: folderName,
                        folderPath,
                        model: selectedModel,
                        indexedAt: Date.now(),
                    };
                    addOrUpdateWorkspace(ws);
                    setActiveWorkspaceId(ws.id);
                    setWorkspaces(loadWorkspaces());
                    toast(`Workspace "${folderName}" indexed ✓`, 'success');
                    setTimeout(() => onIndexed(ws), 800);
                } else if (data.status === 'failed') {
                    setStatusMsg('Indexing failed. Check logs.');
                    setIsIndexing(false);
                    eventSource.close();
                    toast('Indexing failed', 'error');
                }
            };

            eventSource.onerror = () => {
                setStatusMsg('Connection lost. Please try again.');
                setIsIndexing(false);
                eventSource.close();
                toast('Connection to backend lost', 'error');
            };
        } catch (err: any) {
            setStatusMsg(err.message || 'An error occurred.');
            setIsIndexing(false);
            toast(err.message || 'Indexing failed', 'error');
        }
    };

    const hasWorkspaces = workspaces.length > 0;

    return (
        <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-bg-main" role="main" aria-label="Atlas workspace launcher">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent opacity-[0.07] blur-[120px] rounded-full pointer-events-none" />

            {/* Top-Right Settings Button */}
            <div className="absolute top-5 right-5 z-20">
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2.5 rounded-xl border border-glass-border bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
                    title="Settings"
                >
                    <Settings size={18} />
                </button>
            </div>

            {showSettings && (
                <SettingsModal
                    settings={settings}
                    onSave={(s) => {
                        setSettings(s);
                        persistSettings(s);
                        toast('Settings saved', 'success');
                    }}
                    onReindex={() => { }} // No-op from landing screen
                    onClose={() => setShowSettings(false)}
                />
            )}

            <div className="relative z-10 w-full max-w-lg flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="text-center space-y-1">
                    <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-br from-text-primary to-text-secondary bg-clip-text text-transparent">
                        Atlas
                    </h1>
                    <p className="text-text-secondary text-sm font-medium tracking-wide uppercase opacity-70" aria-label="Local AI Workspace — fully offline">Local AI Workspace</p>
                </div>

                {/* Ollama Warning Banner */}
                {settings.provider === 'ollama' && isOllamaRunning === false && (
                    <div role="alert" aria-live="assertive" className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                            <div className="font-semibold">Ollama is not running</div>
                            <div className="text-xs mt-0.5 opacity-80">
                                Start Ollama with <code className="bg-white/10 px-1 rounded font-mono">ollama serve</code> then refresh.
                                Atlas requires a locally running Ollama instance — no internet connection needed.
                            </div>
                        </div>
                    </div>
                )}

                {/* Existing Workspaces */}
                {hasWorkspaces && !showNew && (
                    <GlassPanel className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide" id="workspaces-heading">Recent Workspaces</h2>
                            <button
                                onClick={() => setShowNew(true)}
                                aria-label="Create a new workspace"
                                className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60 rounded-md px-1"
                            >
                                <Plus size={13} aria-hidden="true" />New
                            </button>
                        </div>
                        <div className="space-y-2" role="list" aria-labelledby="workspaces-heading">
                            {workspaces.map(ws => (
                                <div
                                    key={ws.id}
                                    role="listitem"
                                >
                                    <div
                                        onClick={() => openWorkspace(ws)}
                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openWorkspace(ws)}
                                        tabIndex={0}
                                        aria-label={`Open workspace: ${ws.name} at ${ws.folderPath}`}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-glass-border hover:border-accent/40 hover:bg-accent/5 cursor-pointer group transition-all focus:outline-none focus:ring-2 focus:ring-accent/40"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0" aria-hidden="true">
                                            <FolderOpen size={15} className="text-accent" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-text-primary truncate">{ws.name}</div>
                                            <div className="text-[10px] text-text-secondary truncate opacity-60" title={ws.folderPath}>{ws.folderPath}</div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                                            <ExternalLink size={13} className="text-accent" aria-hidden="true" />
                                            <button
                                                onClick={e => deleteWorkspace(ws.id, e)}
                                                aria-label={`Delete workspace ${ws.name}`}
                                                className="p-1 hover:text-red-400 text-text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50 rounded"
                                            >
                                                <Trash2 size={12} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlassPanel>
                )}

                {/* New Workspace Form */}
                {(!hasWorkspaces || showNew) && (
                    <GlassPanel className="p-6 space-y-5">
                        {hasWorkspaces && (
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-text-secondary">New Workspace</h2>
                                <button onClick={() => setShowNew(false)} className="text-xs text-text-secondary hover:text-white transition-colors">Cancel</button>
                            </div>
                        )}

                        {/* Folder */}
                        <div className="space-y-2">
                            <label id="folder-label" className="label-sm flex items-center gap-2">
                                <FolderOpen size={13} className="text-accent" aria-hidden="true" />
                                Workspace Folder
                            </label>
                            <div className="flex gap-2">
                                <div
                                    role="button"
                                    tabIndex={isIndexing ? -1 : 0}
                                    aria-labelledby="folder-label"
                                    aria-describedby={folderPath ? undefined : 'folder-hint'}
                                    aria-disabled={isIndexing}
                                    onClick={selectFolder}
                                    onKeyDown={e => !isIndexing && (e.key === 'Enter' || e.key === ' ') && selectFolder()}
                                    className={`flex-1 bg-glass-bg border border-glass-border rounded-lg px-3 py-2.5 text-sm truncate flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 ${!isIndexing ? 'cursor-pointer hover:bg-[rgba(30,35,45,0.4)]' : 'opacity-60 cursor-not-allowed'}`}
                                >
                                    {folderPath
                                        ? <span className="text-text-primary font-medium" title={folderPath}>{folderPath}</span>
                                        : <span id="folder-hint" className="text-text-secondary opacity-60">Select a local directory…</span>
                                    }
                                </div>
                                <Button onClick={selectFolder} disabled={isIndexing} className="shrink-0 px-5" aria-label="Browse for workspace folder">
                                    Browse
                                </Button>
                            </div>
                        </div>

                        {/* Model */}
                        <div className="space-y-2">
                            <label htmlFor="model-select" className="label-sm flex items-center gap-2">
                                <Cpu size={13} className="text-accent" aria-hidden="true" />
                                LLM Model
                            </label>
                            <div className="relative">
                                <select
                                    id="model-select"
                                    value={selectedModel}
                                    onChange={e => setSelectedModel(e.target.value)}
                                    disabled={isIndexing || (settings.provider === 'ollama' && !isOllamaRunning) || models.length === 0}
                                    aria-required="true"
                                    aria-describedby={!isOllamaRunning && settings.provider === 'ollama' ? 'model-offline-hint' : undefined}
                                    className="w-full rounded-lg bg-glass-bg border border-glass-border px-3 py-2.5 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {models.length > 0
                                        ? models.map(m => <option key={m} value={m} className="bg-bg-main">{m}</option>)
                                        : <option value="">{settings.provider === 'ollama' && isOllamaRunning === false ? 'Ollama Offline — start with `ollama serve`' : 'Loading Models…'}</option>
                                    }
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary text-xs" aria-hidden="true">▼</div>
                            </div>
                            {settings.provider === 'ollama' && isOllamaRunning === false && (
                                <p id="model-offline-hint" className="text-[10px] text-red-400/80 mt-1">
                                    No models available — Ollama is offline. Run <code className="font-mono bg-white/10 px-1 rounded">ollama serve</code> to start it.
                                </p>
                            )}
                        </div>

                        {/* Index Button */}
                        <Button
                            onClick={handleInitialize}
                            disabled={!folderPath || !selectedModel || isIndexing || (settings.provider === 'ollama' && !isOllamaRunning)}
                            className={`w-full py-3 text-sm font-semibold relative overflow-hidden ${isIndexing ? '!bg-glass-bg' : '!bg-[rgba(95,168,255,0.15)] hover:!bg-[rgba(95,168,255,0.25)] border !border-[rgba(95,168,255,0.4)] !text-accent hover:shadow-[0_0_20px_rgba(95,168,255,0.15)]'}`}
                        >
                            {isIndexing ? (
                                <div className="flex items-center justify-center gap-2 text-text-primary">
                                    <Loader2 size={15} className="animate-spin text-accent" />
                                    <span>{statusMsg}</span>
                                </div>
                            ) : progress === 100 ? (
                                <div className="flex items-center justify-center gap-2 text-green-400">
                                    <CheckCircle size={15} /><span>Complete</span>
                                </div>
                            ) : (
                                <span>Initialize Workspace</span>
                            )}
                        </Button>

                        {/* Progress Bar */}
                        {(isIndexing || progress > 0) && (
                            <div className="space-y-1">
                                <div
                                    role="progressbar"
                                    aria-valuenow={Math.round(progress)}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label="Indexing progress"
                                    className="w-full bg-glass-bg border border-glass-border/40 rounded-full h-1 overflow-hidden"
                                >
                                    <div
                                        className="h-full bg-accent transition-all duration-300 shadow-[0_0_10px_rgba(95,168,255,0.5)]"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                {isIndexing && (
                                    <p aria-live="polite" className="text-[10px] text-text-secondary text-right">{Math.round(progress)}%</p>
                                )}
                            </div>
                        )}
                    </GlassPanel>
                )}
            </div>
        </div>
    );
}
