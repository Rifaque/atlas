import { ChevronLeft, FileText, History, Settings, SidebarClose, SidebarOpen } from 'lucide-react';
import type { IndexHealth } from '../lib/api';
import type { AtlasSettings } from '../lib/settings';
import type { Workspace } from '../lib/workspaces';
import { displayPath } from '../lib/paths';
import { IconButton, StatusDot } from './ui';

export type QueryMode = 'ask' | 'find';

function indexPresentation(health: IndexHealth | null) {
    switch (health?.status ?? 'not_indexed') {
        case 'ready': return { label: 'Index ready', tone: 'success' as const };
        case 'queued': return { label: 'Index queued', tone: 'active' as const };
        case 'running': return { label: 'Indexing', tone: 'active' as const };
        case 'failed': return { label: 'Index failed', tone: 'danger' as const };
        case 'incompatible': return { label: 'Rebuild required', tone: 'warning' as const };
        default: return { label: 'Index required', tone: 'warning' as const };
    }
}

export function WorkspaceHeader({
    workspace,
    mode,
    onModeChange,
    indexHealth,
    settings,
    generationReady,
    historyOpen,
    evidenceOpen,
    onToggleHistory,
    onToggleEvidence,
    onOpenSettings,
    onLeaveWorkspace,
}: {
    workspace: Workspace;
    mode: QueryMode;
    onModeChange: (mode: QueryMode) => void;
    indexHealth: IndexHealth | null;
    settings: AtlasSettings;
    generationReady: boolean | null;
    historyOpen: boolean;
    evidenceOpen: boolean;
    onToggleHistory: () => void;
    onToggleEvidence: () => void;
    onOpenSettings: () => void;
    onLeaveWorkspace: () => void;
}) {
    const index = indexPresentation(indexHealth);
    const provider = settings.generationProvider === 'ollama' ? 'Local · Ollama' : 'Cloud · OpenRouter';
    const providerTone = generationReady === false ? 'danger' : generationReady === true ? 'success' : 'neutral';

    return (
        <header className="workspace-header">
            <div className="workspace-header__identity">
                <IconButton label={historyOpen ? 'Close history' : 'Open history'} active={historyOpen} onClick={onToggleHistory}>
                    <History size={17} />
                </IconButton>
                <div className="workspace-identity">
                    <strong>{workspace.name}</strong>
                    <span className="mono" title={displayPath(workspace.folderPath)}>{displayPath(workspace.folderPath)}</span>
                </div>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Workspace query mode">
                <button role="tab" aria-selected={mode === 'ask'} onClick={() => onModeChange('ask')}>Ask</button>
                <button role="tab" aria-selected={mode === 'find'} onClick={() => onModeChange('find')}>Find</button>
            </div>

            <div className="workspace-header__status">
                <span title={indexHealth?.error ?? `${indexHealth?.fileCount ?? 0} files · ${indexHealth?.chunkCount ?? 0} chunks`}>
                    <StatusDot tone={index.tone} label={index.label} />
                </span>
                <span title={settings.generationModel}><StatusDot tone={providerTone} label={provider} /></span>
                <IconButton label={evidenceOpen ? 'Close evidence' : 'Open evidence'} active={evidenceOpen} onClick={onToggleEvidence}>
                    {evidenceOpen ? <SidebarClose size={17} /> : <SidebarOpen size={17} />}
                </IconButton>
                <IconButton label="Settings" onClick={onOpenSettings}><Settings size={17} /></IconButton>
                <IconButton label="Switch workspace" onClick={onLeaveWorkspace}><ChevronLeft size={17} /></IconButton>
            </div>
            <span className="workspace-header__evidence-mark" aria-hidden="true"><FileText size={12} /></span>
        </header>
    );
}
