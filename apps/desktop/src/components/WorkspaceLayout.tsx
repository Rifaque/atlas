import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { EvidenceRef } from '../lib/chats';
import {
    checkOllamaStatus,
    type SearchResult,
} from '../lib/api';
import {
    hasOpenRouterCredential,
    loadSettings,
    persistSettings,
    removeOpenRouterCredential,
    storeOpenRouterCredential,
    type AtlasSettings,
} from '../lib/settings';
import { setTheme } from '../lib/theme';
import { toast } from '../lib/toast';
import type { Workspace } from '../lib/workspaces';
import { useWorkspaceChat } from '../features/ask/useWorkspaceChat';
import { useWorkspaceEvidence } from '../features/evidence/useWorkspaceEvidence';
import { useWorkspaceHistory } from '../features/history/useWorkspaceHistory';
import { useWorkspaceIndex } from '../features/indexing/useWorkspaceIndex';
import { AskView } from './AskView';
import { EvidencePane, type EvidenceSelection, type EvidenceTab } from './EvidencePane';
import { FindView } from './FindView';
import { HistoryPanel } from './HistoryPanel';
import { SettingsModal } from './SettingsModal';
import { Button, InlineAlert } from './ui';
import { WorkspaceHeader, type QueryMode } from './WorkspaceHeader';

interface WorkspaceLayoutProps { workspace: Workspace; onLeaveWorkspace: () => void; }

const clampEvidenceWidth = (value: number) => Math.max(360, Math.min(520, value));

export function WorkspaceLayout({ workspace, onLeaveWorkspace }: WorkspaceLayoutProps) {
    const [settings, setSettings] = useState<AtlasSettings>(() => loadSettings(workspace.id));
    const [credentialExists, setCredentialExists] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [mode, setMode] = useState<QueryMode>('ask');
    const [historyExpanded, setHistoryExpanded] = useState(() => localStorage.getItem('atlas_ui_history_expanded') === 'true');
    const [evidenceOpen, setEvidenceOpen] = useState(() => localStorage.getItem('atlas_ui_evidence_open') === 'true');
    const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>('sources');
    const [activeSources, setActiveSources] = useState<EvidenceRef[]>([]);
    const [selection, setSelection] = useState<EvidenceSelection | null>(null);
    const [evidenceWidth, setEvidenceWidth] = useState(() => clampEvidenceWidth(Number(localStorage.getItem('atlas_ui_evidence_width')) || 420));
    const [compactWindow, setCompactWindow] = useState(() => window.innerWidth < 1100);
    const [generationReady, setGenerationReady] = useState<boolean | null>(null);
    const [unavailableContext, setUnavailableContext] = useState<Set<string>>(() => new Set());

    const history = useWorkspaceHistory(workspace.id);
    const evidence = useWorkspaceEvidence(workspace.id, workspace.embeddingModel, settings.ollamaHost);
    const indexing = useWorkspaceIndex(workspace.id, workspace.embeddingModel, settings.ollamaHost);
    const chat = useWorkspaceChat({
        workspaceId: workspace.id,
        embeddingModel: workspace.embeddingModel,
        settings,
        session: history.activeSession,
        updateSession: history.updateActive,
        onError: message => toast(message, 'error'),
    });

    useEffect(() => {
        void hasOpenRouterCredential().then(setCredentialExists).catch(() => setCredentialExists(false));
    }, []);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 1099px)');
        const update = () => setCompactWindow(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (compactWindow && evidenceOpen && historyExpanded) {
            setHistoryExpanded(false);
            localStorage.setItem('atlas_ui_history_expanded', 'false');
        }
    }, [compactWindow, evidenceOpen, historyExpanded]);

    useEffect(() => {
        let active = true;
        const readiness = settings.generationProvider === 'openrouter'
            ? hasOpenRouterCredential()
            : checkOllamaStatus(settings.ollamaHost).then(status => status === 'online');
        void readiness.then(ready => { if (active) { setGenerationReady(ready); if (settings.generationProvider === 'openrouter') setCredentialExists(ready); } });
        return () => { active = false; };
    }, [settings.generationProvider, settings.ollamaHost]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
            if (event.key === '/' && !editing) {
                event.preventDefault();
                document.getElementById(mode === 'ask' ? 'ask-composer' : 'find-input')?.focus();
            }
            if (event.ctrlKey && event.key === '1') { event.preventDefault(); setMode('ask'); }
            if (event.ctrlKey && event.key === '2') { event.preventDefault(); setMode('find'); }
            if (event.ctrlKey && event.key.toLowerCase() === 'n') { event.preventDefault(); if (!chat.generating) history.newSession(); }
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'h') { event.preventDefault(); toggleHistory(); }
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); toggleEvidence(); }
            if (event.key === 'Escape' && compactWindow && (evidenceOpen || historyExpanded)) {
                setEvidenceOpen(false);
                setHistoryExpanded(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

    const toggleHistory = () => {
        setHistoryExpanded(current => {
            const next = !current;
            localStorage.setItem('atlas_ui_history_expanded', String(next));
            if (next && compactWindow) setEvidenceOpen(false);
            return next;
        });
    };
    const toggleEvidence = () => {
        setEvidenceOpen(current => {
            const next = !current;
            localStorage.setItem('atlas_ui_evidence_open', String(next));
            if (next && compactWindow) setHistoryExpanded(false);
            return next;
        });
    };
    const openEvidence = useCallback((tab: EvidenceTab, target?: EvidenceSelection, sources?: EvidenceRef[]) => {
        setEvidenceTab(tab);
        if (target) setSelection(target);
        if (sources) setActiveSources(sources);
        setEvidenceOpen(true);
        localStorage.setItem('atlas_ui_evidence_open', 'true');
        if (compactWindow) setHistoryExpanded(false);
    }, [compactWindow]);

    const pinned = history.activeSession.manualContext;
    const pinFile = (filePath: string) => {
        if (!pinned.includes(filePath)) history.updateActive(session => ({ ...session, manualContext: [...session.manualContext, filePath] }));
    };
    const unpinFile = (filePath: string) => history.updateActive(session => ({ ...session, manualContext: session.manualContext.filter(path => path !== filePath) }));
    const markUnavailable = useCallback((path: string) => setUnavailableContext(current => new Set(current).add(path)), []);

    const saveSettings = async (next: AtlasSettings) => {
        if (next.openRouterApiKey.trim()) {
            await storeOpenRouterCredential(next.openRouterApiKey.trim());
            setCredentialExists(true);
        }
        const safe = { ...next, openRouterApiKey: '' };
        persistSettings(safe, workspace.id);
        setTheme(safe.theme);
        setSettings(safe);
        setGenerationReady(safe.generationProvider === 'openrouter' ? (credentialExists || Boolean(next.openRouterApiKey.trim())) : null);
        toast('Settings saved', 'success');
    };

    const exportSession = (session = history.activeSession) => {
        const markdown = session.messages.map(message => `**${message.role === 'user' ? 'You' : 'Atlas'}**\n\n${message.content}`).join('\n\n---\n\n');
        const url = URL.createObjectURL(new Blob([`# ${session.title}\n\n${markdown}`], { type: 'text/markdown' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${session.title.replace(/\s+/g, '_')}.md`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const openResult = (result: SearchResult) => openEvidence('sources', { filePath: result.filePath, lineStart: result.lineStart, lineEnd: result.lineEnd }, [result]);
    const askAbout = (result: SearchResult) => {
        pinFile(result.filePath);
        setMode('ask');
        chat.setInput(`Explain how ${result.displayPath} relates to this workspace.`);
    };
    const status = indexing.health?.status ?? 'not_indexed';
    const indexCompatible = !indexing.health?.embeddingModel || indexing.health.embeddingModel === workspace.embeddingModel;
    const canSend = status === 'ready' && indexCompatible && generationReady === true;

    return (
        <div className="workspace-shell">
            {showSettings && <SettingsModal settings={settings} embeddingModel={workspace.embeddingModel} indexHealth={indexing.health} credentialExists={credentialExists} onSave={saveSettings} onRemoveCredential={async () => { await removeOpenRouterCredential(); setCredentialExists(false); if (settings.generationProvider === 'openrouter') setGenerationReady(false); }} onReindex={() => void indexing.refreshIndex().catch(error => toast(String(error), 'error'))} onClose={() => setShowSettings(false)} />}

            <WorkspaceHeader workspace={workspace} mode={mode} onModeChange={setMode} indexHealth={indexing.health} settings={settings} generationReady={generationReady} historyOpen={historyExpanded} evidenceOpen={evidenceOpen} onToggleHistory={toggleHistory} onToggleEvidence={toggleEvidence} onOpenSettings={() => setShowSettings(true)} onLeaveWorkspace={() => { if (chat.generating) void chat.stop().finally(onLeaveWorkspace); else onLeaveWorkspace(); }} />

            {(status !== 'ready' || !indexCompatible || generationReady === false) && (
                <div className="workspace-problem-strip">
                    {!indexCompatible ? (
                        <InlineAlert tone="warning" title="Index rebuild required" actions={<Button size="small" onClick={() => void indexing.refreshIndex()}>Rebuild index</Button>}>This workspace was indexed with {indexing.health?.embeddingModel}; the configured model is {workspace.embeddingModel}.</InlineAlert>
                    ) : status === 'incompatible' ? (
                        <InlineAlert tone="warning" title="Index rebuild required" actions={<Button size="small" onClick={() => void indexing.refreshIndex()}>Rebuild index</Button>}>{indexing.health?.error ?? 'The retrieval index schema changed and must be rebuilt.'}</InlineAlert>
                    ) : status === 'failed' ? (
                        <InlineAlert tone="danger" title="Indexing failed" actions={<Button size="small" onClick={() => void indexing.refreshIndex()}><RefreshCw size={13} /> Retry</Button>}>{indexing.health?.error ?? 'Atlas could not refresh this workspace index.'}</InlineAlert>
                    ) : status === 'running' || status === 'queued' ? (
                        <InlineAlert title={status === 'queued' ? 'Index queued' : 'Indexing workspace'}>Ask and Find will be available when the current index is ready.</InlineAlert>
                    ) : status === 'not_indexed' ? (
                        <InlineAlert tone="warning" title="Index required" actions={<Button size="small" onClick={() => void indexing.refreshIndex()}>Index workspace</Button>}>Create an index before using Ask or Find.</InlineAlert>
                    ) : generationReady === false ? (
                        <InlineAlert tone="danger" title="Generation provider unavailable" actions={<Button size="small" onClick={() => setShowSettings(true)}>Open settings</Button>}>{settings.generationProvider === 'ollama' ? `Ollama did not respond at ${settings.ollamaHost}.` : 'Store an OpenRouter credential and authorize cloud generation for this workspace.'}</InlineAlert>
                    ) : null}
                </div>
            )}

            <div className="workspace-body">
                <HistoryPanel sessions={history.sessions} activeSessionId={history.activeSession.id} expanded={historyExpanded} generating={chat.generating} onToggle={toggleHistory} onNew={history.newSession} onSelect={history.selectSession} onRename={(session, title) => void history.renameSession(session, title)} onDelete={id => { if (window.confirm('Delete this conversation?')) void history.removeSession(id); }} onExport={exportSession} />

                <main className="query-surface">
                    {mode === 'ask' ? (
                        <AskView workspaceName={workspace.name} session={history.activeSession} input={chat.input} generating={chat.generating} stopping={chat.stopping} preflightError={chat.preflightError} canSend={canSend} settings={settings} onInput={chat.setInput} onAsk={query => void chat.ask(query)} onStop={() => void chat.stop()} onOpenEvidence={(sources, source) => openEvidence('sources', source ? { filePath: source.filePath, lineStart: source.lineStart, lineEnd: source.lineEnd } : undefined, sources)} onOpenContext={() => openEvidence('context')} onExample={chat.setInput} />
                    ) : (
                        <FindView query={evidence.query} results={evidence.results} searching={evidence.searching} error={evidence.error} onQuery={evidence.setQuery} onFind={() => void evidence.find()} onOpen={openResult} onPin={pinFile} onAskAbout={askAbout} />
                    )}
                </main>

                {evidenceOpen && <EvidencePane workspaceId={workspace.id} tab={evidenceTab} onTab={setEvidenceTab} sources={activeSources} selection={selection} tree={evidence.tree} pinned={pinned} unavailable={unavailableContext} includeGitContext={settings.includeGitContext} width={evidenceWidth} overlay={compactWindow} onWidth={value => { const next = clampEvidenceWidth(value); setEvidenceWidth(next); localStorage.setItem('atlas_ui_evidence_width', String(next)); }} onSelect={setSelection} onPin={pinFile} onUnpin={unpinFile} onClear={() => { if (window.confirm('Clear all pinned context from this chat?')) history.updateActive(session => ({ ...session, manualContext: [] })); }} onUnavailable={markUnavailable} onClose={() => { setEvidenceOpen(false); localStorage.setItem('atlas_ui_evidence_open', 'false'); }} />}
            </div>
        </div>
    );
}
