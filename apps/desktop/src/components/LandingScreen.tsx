import { useEffect, useMemo, useState } from 'react';
import { Database, FolderOpen, Plus, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import {
    checkOllamaStatus,
    fetchIndexHealth,
    fetchModels,
    getIndexJob,
    isWorkspaceAuthorized,
    listenIndexProgress,
    selectWorkspace,
    startIndexing,
    type IndexHealth,
    type IndexProgress,
} from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import {
    hasOpenRouterCredential,
    loadSettings,
    persistSettings,
    removeOpenRouterCredential,
    storeOpenRouterCredential,
    type AtlasSettings,
} from '../lib/settings';
import { displayPath } from '../lib/paths';
import { setTheme } from '../lib/theme';
import { toast } from '../lib/toast';
import {
    addOrUpdateWorkspace,
    loadWorkspaces,
    patchWorkspace,
    removeWorkspace,
    setActiveWorkspace,
    type Workspace,
} from '../lib/workspaces';
import { SettingsModal } from './SettingsModal';
import { Button, EmptyState, IconButton, InlineAlert, StatusDot } from './ui';

interface LandingScreenProps { onIndexed: (workspace: Workspace) => void; }
interface WorkspaceSummary { available: boolean; health: IndexHealth | null; loading: boolean; }
const currentTimestamp = () => Date.now();

function timeLabel(value?: number | null) {
    if (!value) return 'Never indexed';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function healthLabel(workspace: Workspace, summary?: WorkspaceSummary) {
    if (!summary || summary.loading) return { label: 'Checking workspace', tone: 'neutral' as const };
    if (!summary.available) return { label: 'Workspace unavailable', tone: 'danger' as const };
    if (summary.health?.embeddingModel && summary.health.embeddingModel !== workspace.embeddingModel) return { label: 'Index rebuild required', tone: 'warning' as const };
    switch (summary.health?.status) {
        case 'ready': return { label: 'Index ready', tone: 'success' as const };
        case 'running': return { label: 'Indexing', tone: 'active' as const };
        case 'queued': return { label: 'Index queued', tone: 'active' as const };
        case 'failed': return { label: 'Index failed', tone: 'danger' as const };
        case 'incompatible': return { label: 'Index rebuild required', tone: 'warning' as const };
        default: return { label: 'Index required', tone: 'warning' as const };
    }
}

export function LandingScreen({ onIndexed }: LandingScreenProps) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces);
    const [summaries, setSummaries] = useState<Record<string, WorkspaceSummary>>(() => Object.fromEntries(loadWorkspaces().map(item => [item.id, { available: false, health: null, loading: true }])));
    const [showNew, setShowNew] = useState(false);
    const [folderPath, setFolderPath] = useState<string | null>(null);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
    const [progress, setProgress] = useState<IndexProgress | null>(null);
    const [indexError, setIndexError] = useState<string | null>(null);
    const [settings, setSettings] = useState<AtlasSettings>(() => loadSettings());
    const [showSettings, setShowSettings] = useState(false);
    const [credentialExists, setCredentialExists] = useState(false);

    useEffect(() => {
        let active = true;
        void Promise.all(workspaces.map(async workspace => {
            const available = await isWorkspaceAuthorized(workspace.folderPath).catch(() => false);
            const health = available ? await fetchIndexHealth(workspace.id).catch(() => null) : null;
            return [workspace.id, { available, health, loading: false }] as const;
        })).then(entries => { if (active) setSummaries(Object.fromEntries(entries)); });
        return () => { active = false; };
    }, [workspaces]);
    useEffect(() => { void hasOpenRouterCredential().then(setCredentialExists).catch(() => setCredentialExists(false)); }, []);

    useEffect(() => {
        if (!showNew) return;
        let active = true;
        void checkOllamaStatus(settings.ollamaHost).then(async status => {
            if (!active) return;
            const online = status === 'online';
            setOllamaOnline(online);
            const next = online ? await fetchModels(settings.ollamaHost) : [];
            if (!active) return;
            setModels(next);
            const preferred = next.find(model => /embed|nomic|bge|mxbai/i.test(model));
            setSelectedModel(current => current || preferred || next[0] || '');
        });
        return () => { active = false; };
    }, [settings.ollamaHost, showNew]);

    const openWorkspace = async (workspace: Workspace) => {
        const authorized = await isWorkspaceAuthorized(workspace.folderPath).catch(() => false);
        if (!authorized) {
            setSummaries(current => ({ ...current, [workspace.id]: { available: false, health: null, loading: false } }));
            return;
        }
        patchWorkspace(workspace.id, { lastOpened: currentTimestamp() });
        setActiveWorkspace(workspace.id);
        onIndexed(workspace);
    };

    const chooseFolder = async () => {
        const selected = await selectWorkspace();
        if (!selected) return;
        setIndexError(null);
        const existing = workspaces.find(workspace => workspace.folderPath === selected);
        if (existing) {
            const health = await fetchIndexHealth(existing.id).catch(() => null);
            if (health?.status === 'ready' && (!health.embeddingModel || health.embeddingModel === existing.embeddingModel)) {
                const opened = { ...existing, lastOpened: currentTimestamp() };
                patchWorkspace(existing.id, { lastOpened: opened.lastOpened });
                setActiveWorkspace(existing.id);
                onIndexed(opened);
                return;
            }
            setSelectedModel(existing.embeddingModel);
        }
        setFolderPath(selected);
    };

    const initialize = async () => {
        if (!folderPath || !selectedModel) return;
        setIndexError(null);
        setProgress({ status: 'queued', processedFiles: 0, totalFiles: 0, totalChunks: 0 });
        try {
            const jobId = await startIndexing(folderPath, selectedModel, settings.ollamaHost);
            let unlisten: () => void = () => undefined;
            const handle = (next: IndexProgress) => {
                setProgress(next);
                if (next.status === 'completed') {
                    unlisten();
                    const name = folderPath.split(/[/\\]/).pop() || folderPath;
                    const workspace: Workspace = { id: folderPath, name, folderPath, embeddingModel: selectedModel, indexedAt: currentTimestamp(), lastIndexStatus: 'ready' };
                    addOrUpdateWorkspace(workspace);
                    setActiveWorkspace(workspace.id);
                    toast(`Indexed ${name}`, 'success');
                    onIndexed(workspace);
                }
                if (next.status === 'failed') {
                    unlisten();
                    setIndexError(next.error || 'Indexing failed. Check the embedding provider and retry.');
                }
            };
            unlisten = await listenIndexProgress(jobId, handle);
            handle(await getIndexJob(jobId));
        } catch (error) {
            setIndexError(getErrorMessage(error));
            setProgress(null);
        }
    };

    const saveSettings = async (next: AtlasSettings) => {
        if (next.openRouterApiKey.trim()) {
            await storeOpenRouterCredential(next.openRouterApiKey.trim());
            setCredentialExists(true);
        }
        const safe = { ...next, openRouterApiKey: '' };
        persistSettings(safe);
        setSettings(safe);
        setTheme(safe.theme);
        toast('Settings saved', 'success');
    };

    const progressPercent = useMemo(() => progress?.totalFiles ? Math.round(((progress.processedFiles ?? 0) / progress.totalFiles) * 100) : null, [progress]);
    const indexing = progress?.status === 'queued' || progress?.status === 'running' || progress?.status === 'recovering';

    return (
        <main className="launcher" aria-label="Atlas workspace launcher">
            {showSettings && <SettingsModal settings={settings} embeddingModel={selectedModel} indexHealth={null} credentialExists={credentialExists} onSave={saveSettings} onRemoveCredential={async () => { await removeOpenRouterCredential(); setCredentialExists(false); }} onReindex={() => undefined} onClose={() => setShowSettings(false)} />}
            <header className="launcher-header">
                <div className="atlas-wordmark"><img src="/atlas-mark.svg" alt="" /><div><strong>Atlas</strong><small>Workspace intelligence</small></div></div>
                <IconButton label="Settings" onClick={() => setShowSettings(true)}><SettingsIcon size={17} /></IconButton>
            </header>
            <section className="launcher-content" aria-labelledby="workspaces-title">
                <div className="launcher-title">
                    <div><h1 id="workspaces-title">Workspaces</h1><p>Open one codebase or document set.</p></div>
                    <Button variant="primary" onClick={() => setShowNew(true)}><FolderOpen size={15} /> Open workspace…</Button>
                </div>

                {!workspaces.length && !showNew ? (
                    <EmptyState icon={<Database size={18} />} title="No workspaces yet" action={<Button variant="primary" onClick={() => setShowNew(true)}><Plus size={15} /> Open workspace</Button>}>
                        Open a local folder to index it and ask grounded questions about its contents.
                    </EmptyState>
                ) : (
                    <div className="workspace-list" role="list" aria-label="Recent workspaces">
                        {workspaces.map(workspace => {
                            const summary = summaries[workspace.id];
                            const presentation = healthLabel(workspace, summary);
                            return (
                                <article className="workspace-row" role="listitem" key={workspace.id}>
                                    <button className="workspace-row__main" onClick={() => void openWorkspace(workspace)} disabled={summary?.loading}>
                                        <span className="workspace-row__icon"><FolderOpen size={17} /></span>
                                        <span className="workspace-row__identity"><strong>{workspace.name}</strong><span className="mono" title={displayPath(workspace.folderPath)}>{displayPath(workspace.folderPath)}</span></span>
                                        <span className="workspace-row__facts">
                                            <StatusDot tone={presentation.tone} label={presentation.label} />
                                            <small>{summary?.health?.fileCount ? `${summary.health.fileCount} files · ${summary.health.chunkCount} chunks` : timeLabel(summary?.health?.lastCompletedAt ?? workspace.indexedAt)}</small>
                                        </span>
                                        <span className="workspace-row__open">{summary && !summary.available ? 'Locate' : 'Open'}</span>
                                    </button>
                                    <div className="workspace-row__menu">
                                        <IconButton label={`Remove ${workspace.name} from launcher`} onClick={() => {
                                            const next = removeWorkspace(workspace.id);
                                            setWorkspaces(next);
                                            toast('Removed from launcher. Index and history data were retained.', 'info');
                                        }}><Trash2 size={14} /></IconButton>
                                    </div>
                                    {summary && !summary.available && <InlineAlert tone="warning" title="Workspace unavailable">Select Open workspace and choose this folder again to restore Atlas access.</InlineAlert>}
                                </article>
                            );
                        })}
                    </div>
                )}

                {showNew && (
                    <section className="open-workspace" aria-labelledby="open-workspace-title">
                        <header><div><h2 id="open-workspace-title">Open workspace</h2><p>Select a folder. Atlas will index supported files using a local embedding model.</p></div><Button variant="quiet" onClick={() => { setShowNew(false); setProgress(null); setIndexError(null); }}>Cancel</Button></header>
                        <div className="open-workspace__folder">
                            <Button onClick={chooseFolder} disabled={indexing}><FolderOpen size={15} /> {folderPath ? 'Choose another folder' : 'Choose folder'}</Button>
                            <span className="mono">{folderPath ? displayPath(folderPath) : 'No folder selected'}</span>
                        </div>
                        {ollamaOnline === false && <InlineAlert tone="danger" title="Embedding provider unavailable">Start Ollama at {settings.ollamaHost}, then reopen this step or update the host in Settings.</InlineAlert>}
                        {folderPath && ollamaOnline && (
                            <div className="index-prerequisites">
                                <label htmlFor="embedding-model">Embedding model</label>
                                <select id="embedding-model" className="ui-input mono" value={selectedModel} onChange={event => setSelectedModel(event.target.value)} disabled={indexing}>
                                    {models.map(model => <option value={model} key={model}>{model}</option>)}
                                </select>
                                <p>This model creates the workspace index. Changing it later requires a rebuild.</p>
                                {progress && <div className="index-progress" role="status" aria-live="polite"><span>{progress.status === 'queued' ? 'Waiting to index' : progress.status === 'running' ? 'Indexing workspace' : progress.status === 'recovering' ? 'Rebuilding local index' : progress.status}</span><span>{progress.processedFiles ?? 0} files · {progress.totalChunks ?? 0} chunks</span>{progressPercent !== null && <progress max="100" value={progressPercent}>{progressPercent}%</progress>}</div>}
                                {progress?.recoveryMessage && <InlineAlert tone="warning" title="Rebuilding local index">{progress.recoveryMessage}</InlineAlert>}
                                {indexError && <InlineAlert tone="danger" title="Indexing failed">{indexError}</InlineAlert>}
                                <Button variant="primary" loading={indexing} disabled={!selectedModel || indexing} onClick={initialize}>{indexError ? 'Retry indexing' : 'Index workspace'}</Button>
                            </div>
                        )}
                    </section>
                )}
            </section>
            <footer className="launcher-footer">Local-first by default. Cloud generation is optional and workspace-authorized.</footer>
        </main>
    );
}
