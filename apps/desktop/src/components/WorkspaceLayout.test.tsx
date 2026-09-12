// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatSession } from '../lib/chats';

const mocks = vi.hoisted(() => ({
    setInput: vi.fn(),
    find: vi.fn(),
    updateActive: vi.fn(),
}));

const session: ChatSession = { id: 'chat-1', workspaceId: 'C:/workspace-a', title: 'New Chat', updatedAt: 1, messages: [], manualContext: [] };
const result = { id: 'source-1', workspaceId: 'C:/workspace-a', filePath: 'C:/workspace-a/src/main.ts', displayPath: 'src/main.ts', lineStart: 1, lineEnd: 3, snippet: 'export const main = true;', content: 'export const main = true;', sourceType: 'workspace_file' as const };

vi.mock('../features/history/useWorkspaceHistory', () => ({ useWorkspaceHistory: () => ({ sessions: [], activeSession: session, updateActive: mocks.updateActive, newSession: vi.fn(), selectSession: vi.fn(), removeSession: vi.fn(), renameSession: vi.fn() }) }));
vi.mock('../features/evidence/useWorkspaceEvidence', () => ({ useWorkspaceEvidence: () => ({ query: 'main', setQuery: vi.fn(), results: [result], searching: false, error: null, find: mocks.find, tree: [] }) }));
vi.mock('../features/indexing/useWorkspaceIndex', () => ({ useWorkspaceIndex: () => ({ health: { status: 'ready', fileCount: 1, chunkCount: 1, embeddingModel: 'nomic', lastCompletedAt: 1, error: null }, refreshIndex: vi.fn() }) }));
vi.mock('../features/ask/useWorkspaceChat', () => ({ useWorkspaceChat: () => ({ input: 'draft question', setInput: mocks.setInput, generating: false, stopping: false, preflightError: null, ask: vi.fn(), stop: vi.fn() }) }));
vi.mock('../lib/api', async importOriginal => ({
    ...(await importOriginal<typeof import('../lib/api')>()),
    checkOllamaStatus: vi.fn().mockResolvedValue('online'),
    fetchFileContent: vi.fn().mockResolvedValue({
        content: 'export function authenticate() {}',
        totalLines: 1,
    }),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(false) }));

import { WorkspaceLayout } from './WorkspaceLayout';

describe('workspace mode integration', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    });
    afterEach(cleanup);

    it('switches Ask and Find without losing the Ask draft', async () => {
        render(<WorkspaceLayout workspace={{ id: 'C:/workspace-a', name: 'workspace-a', folderPath: 'C:/workspace-a', embeddingModel: 'nomic', indexedAt: 1 }} onLeaveWorkspace={vi.fn()} />);
        expect(screen.getByLabelText('Ask a question')).toHaveValue('draft question');
        await userEvent.click(screen.getByRole('tab', { name: 'Find' }));
        expect(screen.getByLabelText('Find files and passages')).toBeVisible();
        await userEvent.click(screen.getByRole('tab', { name: 'Ask' }));
        expect(screen.getByLabelText('Ask a question')).toHaveValue('draft question');
    });

    it('opens a Find result in the non-modal Evidence pane', async () => {
        render(<WorkspaceLayout workspace={{ id: 'C:/workspace-a', name: 'workspace-a', folderPath: 'C:/workspace-a', embeddingModel: 'nomic', indexedAt: 1 }} onLeaveWorkspace={vi.fn()} />);
        await userEvent.click(screen.getByRole('tab', { name: 'Find' }));
        await userEvent.click(screen.getByRole('button', { name: /src\/main.ts/ }));
        expect(screen.getByRole('complementary', { name: 'Evidence and files' })).toBeVisible();
        expect(screen.getByRole('tab', { name: 'Sources' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getAllByText(/Lines 1.*3/).length).toBeGreaterThan(0);
    });

    it('keeps persisted History and Evidence drawers mutually exclusive at narrow width', async () => {
        localStorage.setItem('atlas_ui_history_expanded', 'true');
        localStorage.setItem('atlas_ui_evidence_open', 'true');
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
        });

        const { container } = render(<WorkspaceLayout workspace={{ id: 'C:/workspace-a', name: 'workspace-a', folderPath: 'C:/workspace-a', embeddingModel: 'nomic', indexedAt: 1 }} onLeaveWorkspace={vi.fn()} />);

        await waitFor(() => expect(container.querySelector('.history-panel')).not.toHaveClass('is-expanded'));
        expect(screen.getByRole('complementary', { name: 'Evidence and files' })).toHaveClass('is-overlay');
        expect(localStorage.getItem('atlas_ui_history_expanded')).toBe('false');
    });
});
