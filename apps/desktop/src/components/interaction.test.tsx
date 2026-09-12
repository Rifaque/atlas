// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatSession, EvidenceRef } from '../lib/chats';
import { DEFAULT_SETTINGS } from '../lib/settings';
import type { IndexHealth, SearchResult } from '../lib/api';
import { AskView } from './AskView';
import { EvidencePane } from './EvidencePane';
import { FindView } from './FindView';
import { HistoryPanel } from './HistoryPanel';
import { SettingsModal } from './SettingsModal';
import { WorkspaceHeader } from './WorkspaceHeader';

const source: EvidenceRef = {
    id: 'source-1', workspaceId: 'C:/workspace-a', filePath: 'C:/workspace-a/src/auth.ts',
    displayPath: 'src/auth.ts', lineStart: 8, lineEnd: 14, snippet: 'export function authenticate() {}', sourceType: 'workspace_file',
};

const session: ChatSession = {
    id: 'chat-1', workspaceId: 'C:/workspace-a', title: 'Authentication', updatedAt: Date.now(), manualContext: ['C:/workspace-a/src/auth.ts'],
    messages: [{ role: 'assistant', content: 'Authentication is handled here.', evidence: [source], status: 'complete' }],
};

describe('Atlas interaction surfaces', () => {
    afterEach(cleanup);
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    });

    it('opens the correct evidence from an Ask citation and keeps context visible', async () => {
        const openEvidence = vi.fn();
        render(<AskView workspaceName="workspace-a" session={session} input="" generating={false} stopping={false} preflightError={null} canSend settings={DEFAULT_SETTINGS} onInput={vi.fn()} onAsk={vi.fn()} onStop={vi.fn()} onOpenEvidence={openEvidence} onOpenContext={vi.fn()} onExample={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Context · 1 file/ })).toBeVisible();
        await userEvent.click(screen.getByRole('button', { name: 'Evidence considered 1' }));
        expect(openEvidence).toHaveBeenCalledWith([source], source);
    });

    it('renders a cloud payload failure persistently with the affected turn', () => {
        render(<AskView workspaceName="workspace-a" session={{ ...session, messages: [{ role: 'assistant', content: '', status: 'failed', error: 'Cloud payload blocked by outbound policy' }] }} input="" generating={false} stopping={false} preflightError={null} canSend settings={{ ...DEFAULT_SETTINGS, generationProvider: 'openrouter' }} onInput={vi.fn()} onAsk={vi.fn()} onStop={vi.fn()} onOpenEvidence={vi.fn()} onOpenContext={vi.fn()} onExample={vi.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Request not sent');
        expect(screen.getByText(/Cloud payload blocked/)).toBeVisible();
    });

    it('labels user-selected pinned evidence separately from retrieved evidence', () => {
        const pinnedSource: EvidenceRef = { ...source, id: 'pinned-source', sourceType: 'pinned_workspace_file' };
        render(<EvidencePane workspaceId="C:/workspace-a" tab="sources" onTab={vi.fn()} sources={[pinnedSource, source]} selection={null} tree={[]} pinned={[pinnedSource.filePath]} unavailable={new Set()} includeGitContext={false} width={420} overlay={false} onWidth={vi.fn()} onSelect={vi.fn()} onPin={vi.fn()} onUnpin={vi.fn()} onClear={vi.fn()} onUnavailable={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('Pinned')).toBeVisible();
        expect(screen.getByText('Retrieved')).toBeVisible();
    });

    it('Find opens, pins, and transfers a result into Ask', async () => {
        const result: SearchResult = { ...source, content: source.snippet };
        const open = vi.fn(); const pin = vi.fn(); const ask = vi.fn();
        render(<FindView query="auth" results={[result]} searching={false} error={null} onQuery={vi.fn()} onFind={vi.fn()} onOpen={open} onPin={pin} onAskAbout={ask} />);
        await userEvent.click(screen.getByRole('button', { name: /src\/auth.ts/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
        await userEvent.click(screen.getByRole('button', { name: 'Ask about this' }));
        expect(open).toHaveBeenCalledWith(result);
        expect(pin).toHaveBeenCalledWith(result.filePath);
        expect(ask).toHaveBeenCalledWith(result);
    });

    it('history renders the active workspace session and exposes explicit actions', async () => {
        const select = vi.fn(); const toggle = vi.fn();
        render(<HistoryPanel sessions={[session]} activeSessionId={session.id} expanded generating={false} onToggle={toggle} onNew={vi.fn()} onSelect={select} onRename={vi.fn()} onDelete={vi.fn()} onExport={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: session.title }));
        await userEvent.click(screen.getByRole('button', { name: 'Collapse history' }));
        expect(select).toHaveBeenCalledWith(session);
        expect(toggle).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: `Rename ${session.title}` })).toBeInTheDocument();
    });

    it('context basket shows unavailable items and removes them', async () => {
        const unpin = vi.fn();
        render(<EvidencePane workspaceId="C:/workspace-a" tab="context" onTab={vi.fn()} sources={[]} selection={null} tree={[]} pinned={[source.filePath]} unavailable={new Set([source.filePath])} includeGitContext width={420} overlay={false} onWidth={vi.fn()} onSelect={vi.fn()} onPin={vi.fn()} onUnpin={unpin} onClear={vi.fn()} onUnavailable={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('File unavailable')).toBeVisible();
        await userEvent.click(screen.getByRole('button', { name: `Remove ${source.filePath} from context` }));
        expect(unpin).toHaveBeenCalledWith(source.filePath);
    });

    it.each([
        ['not_indexed', 'Index required'], ['running', 'Indexing'], ['failed', 'Index failed'],
        ['incompatible', 'Rebuild required'], ['ready', 'Index ready'],
    ] as const)('renders factual %s index state', (status, label) => {
        const health: IndexHealth = { status, fileCount: 4, chunkCount: 9, embeddingModel: 'nomic', lastCompletedAt: null, error: status === 'failed' ? 'failed' : null };
        render(<WorkspaceHeader workspace={{ id: 'C:/workspace-a', name: 'workspace-a', folderPath: 'C:/workspace-a', embeddingModel: 'nomic', indexedAt: 1 }} mode="ask" onModeChange={vi.fn()} indexHealth={health} settings={DEFAULT_SETTINGS} generationReady historyOpen={false} evidenceOpen={false} onToggleHistory={vi.fn()} onToggleEvidence={vi.fn()} onOpenSettings={vi.fn()} onLeaveWorkspace={vi.fn()} />);
        expect(screen.getByText(label)).toBeVisible();
        expect(screen.getByText('Local · Ollama')).toBeVisible();
    });

    it('requires the first OpenRouter disclosure and never displays a stored secret', async () => {
        const save = vi.fn();
        render(<SettingsModal settings={{ ...DEFAULT_SETTINGS, generationProvider: 'openrouter' }} embeddingModel="nomic" indexHealth={null} credentialExists onSave={save} onRemoveCredential={vi.fn()} onReindex={vi.fn()} onClose={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Models & Privacy' }));
        expect(screen.getByText(/complete request to the cloud/)).toBeVisible();
        expect(screen.queryByDisplayValue(/sk-/)).not.toBeInTheDocument();
        const saveButton = screen.getByRole('button', { name: 'Save changes' });
        expect(saveButton).toBeDisabled();
        await userEvent.click(screen.getByLabelText(/Enable OpenRouter for this workspace/));
        expect(saveButton).toBeEnabled();
    });

    it('validates the Ollama host inline before settings can save', async () => {
        render(<SettingsModal settings={{ ...DEFAULT_SETTINGS, ollamaHost: 'not a url' }} embeddingModel="nomic" indexHealth={null} credentialExists={false} onSave={vi.fn()} onRemoveCredential={vi.fn()} onReindex={vi.fn()} onClose={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Models & Privacy' }));
        expect(screen.getByText('Enter an HTTP or HTTPS URL.')).toBeVisible();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('saves settings as an explicit draft action', async () => {
        const save = vi.fn();
        render(<SettingsModal settings={DEFAULT_SETTINGS} embeddingModel="nomic" indexHealth={null} credentialExists={false} onSave={save} onRemoveCredential={vi.fn()} onReindex={vi.fn()} onClose={vi.fn()} />);
        await userEvent.selectOptions(screen.getByLabelText('Theme'), 'light');
        expect(screen.getByText('Unsaved changes')).toBeVisible();
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light' })));
    });

    it('Ask textarea submits with Enter and preserves Shift+Enter', () => {
        const ask = vi.fn();
        render(<AskView workspaceName="workspace-a" session={{ ...session, messages: [] }} input="question" generating={false} stopping={false} preflightError={null} canSend settings={DEFAULT_SETTINGS} onInput={vi.fn()} onAsk={ask} onStop={vi.fn()} onOpenEvidence={vi.fn()} onOpenContext={vi.fn()} onExample={vi.fn()} />);
        const input = screen.getByLabelText('Ask a question');
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
        expect(ask).not.toHaveBeenCalled();
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(ask).toHaveBeenCalledWith('question');
    });

    it('settings dialog traps Escape through its close contract', async () => {
        const close = vi.fn();
        render(<SettingsModal settings={DEFAULT_SETTINGS} embeddingModel="nomic" indexHealth={null} credentialExists={false} onSave={vi.fn()} onRemoveCredential={vi.fn()} onReindex={vi.fn()} onClose={close} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(close).toHaveBeenCalledOnce());
    });
});
