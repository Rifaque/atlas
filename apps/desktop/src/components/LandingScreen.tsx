import { useState, useEffect } from 'react';
import { Button } from './Button';
import { GlassPanel } from './GlassPanel';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Cpu, Loader2, AlertCircle, CheckCircle, Plus, Trash2, ExternalLink, Compass } from 'lucide-react';
import { fetchModels, checkOllamaStatus, startIndexing, listenIndexProgress, fetchOpenRouterModels } from '../lib/api';
import {
    loadWorkspaces, addOrUpdateWorkspace, removeWorkspace, setActiveWorkspaceId, patchWorkspace,
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
                    const orRes = await fetchOpenRouterModels(settings.openRouterApiKey);
                    const ms = [...orRes.free, ...orRes.paid];
                    setModels(ms);
                    if (ms.length > 0 && !selectedModel) setSelectedModel(ms[0]);
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
    }, [settings.provider, settings.openRouterApiKey]);

    const selectFolder = async () => {
        if (isIndexing) return;
        try {
            const selected = await open({ directory: true, multiple: false });
            if (selected) setFolderPath(selected as string);
        } catch { }
    };

    const openWorkspace = (ws: Workspace) => {
        patchWorkspace(ws.id, { lastOpened: Date.now() });
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
            const unlisten = await listenIndexProgress(jobId, (data) => {
                if (data.status === 'running') {
                    setStatusMsg(`Indexing files… (${data.processedFiles} processed, ${data.totalChunks} chunks)`);
                    setProgress(50);
                } else if (data.status === 'completed') {
                    setStatusMsg('Indexing complete!');
                    setProgress(100);
                    unlisten();
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
                    unlisten();
                    toast('Indexing failed', 'error');
                }
            });
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
                            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide" id="workspaces-heading">Your Workspaces</h2>
                            <button
                                onClick={() => setShowNew(true)}
                                aria-label="Create a new workspace"
                                className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-accent/60 rounded-md px-1"
                            >
                                <Plus size={13} aria-hidden="true" />New
                            </button>
                        </div>
                        <div className="space-y-2" role="list" aria-labelledby="workspaces-heading">
                            {workspaces.map(ws => {
                                const displayName = ws.displayName || ws.name;
                                const icon = ws.icon || '📁';
                                const timeAgo = ws.lastOpened
                                    ? (() => {
                                        const diff = Date.now() - ws.lastOpened;
                                        const mins = Math.floor(diff / 60000);
                                        if (mins < 1) return 'Just now';
                                        if (mins < 60) return `${mins}m ago`;
                                        const hrs = Math.floor(mins / 60);
                                        if (hrs < 24) return `${hrs}h ago`;
                                        const days = Math.floor(hrs / 24);
                                        return `${days}d ago`;
                                    })()
                                    : ws.indexedAt
                                        ? new Date(ws.indexedAt).toLocaleDateString()
                                        : null;

                                return (
                                    <div
                                        key={ws.id}
                                        role="listitem"
                                        onClick={() => openWorkspace(ws)}
                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openWorkspace(ws)}
                                        tabIndex={0}
                                        aria-label={`Open workspace: ${displayName} at ${ws.folderPath}`}
                                        className="flex items-center gap-3 p-3.5 rounded-xl border border-border-subtle hover:border-accent/40 hover:bg-bg-surface-hover hover:shadow-md hover:shadow-accent/5 cursor-pointer group transition-all focus:outline-none focus:ring-2 focus:ring-accent/40"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-bg-surface border border-border-subtle flex items-center justify-center shrink-0 text-lg group-hover:border-accent/30 transition-colors" aria-hidden="true">
                                            {icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-text-primary truncate">{displayName}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-text-muted truncate" title={ws.folderPath}>{ws.folderPath}</span>
                                                {timeAgo && <span className="text-[10px] text-text-muted shrink-0">· {timeAgo}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                                            <ExternalLink size={13} className="text-accent" aria-hidden="true" />
                                            <button
                                                onClick={e => deleteWorkspace(ws.id, e)}
                                                aria-label={`Delete workspace ${displayName}`}
                                                className="p-1 hover:text-red-400 text-text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50 rounded"
                                            >
                                                <Trash2 size={12} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </GlassPanel>
                )}

                {/* Empty State */}
                {!hasWorkspaces && !showNew && (
                    <GlassPanel className="p-8 flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center">
                            <Compass size={28} className="text-accent opacity-50" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-text-primary">Welcome to Atlas</h2>
                            <p className="text-sm text-text-secondary mt-1 max-w-xs">Get started by indexing a local folder. Atlas will learn your codebase and answer questions about it.</p>
                        </div>
                        <button
                            onClick={() => setShowNew(true)}
                            className="flex items-center gap-2 text-sm font-medium text-white hover:text-white bg-accent hover:bg-accent-hover shadow-lg shadow-accent/20 border border-transparent px-5 py-2.5 rounded-xl transition-all"
                        >
                            <Plus size={16} /> Create Your First Workspace
                        </button>
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
                            className={`w-full py-3 text-sm font-semibold relative overflow-hidden transition-all duration-300 ${isIndexing ? 'bg-glass-bg border border-glass-border text-text-primary' : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/25 border border-transparent'}`}
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
