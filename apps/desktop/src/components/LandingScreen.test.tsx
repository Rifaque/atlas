// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IndexHealth } from '../lib/api';

const mocks = vi.hoisted(() => ({
    authorized: vi.fn(),
    health: vi.fn(),
    select: vi.fn(),
}));

vi.mock('../lib/api', () => ({
    isWorkspaceAuthorized: mocks.authorized,
    fetchIndexHealth: mocks.health,
    checkOllamaStatus: vi.fn().mockResolvedValue('offline'),
    fetchModels: vi.fn().mockResolvedValue([]),
    selectWorkspace: mocks.select,
    getIndexJob: vi.fn(),
    listenIndexProgress: vi.fn(),
    startIndexing: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(false) }));

import { LandingScreen } from './LandingScreen';

const ready: IndexHealth = { status: 'ready', fileCount: 12, chunkCount: 30, embeddingModel: 'nomic', lastCompletedAt: 123, error: null };

function storeWorkspace() {
    localStorage.setItem('atlas_workspaces_v2', JSON.stringify({
        version: 2,
        activeWorkspaceId: null,
        workspaces: [{ id: 'C:/workspace-a', name: 'workspace-a', folderPath: 'C:/workspace-a', embeddingModel: 'nomic', indexedAt: 123 }],
    }));
}

describe('workspace launcher', () => {
    beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.select.mockResolvedValue(null); storeWorkspace(); });
    afterEach(cleanup);

    it('renders a recent workspace with factual ready counts', async () => {
        mocks.authorized.mockResolvedValue(true);
        mocks.health.mockResolvedValue(ready);
        render(<LandingScreen onIndexed={vi.fn()} />);
        expect(screen.getByText('workspace-a')).toBeVisible();
        await waitFor(() => expect(screen.getByText('Index ready')).toBeVisible());
        expect(screen.getByText('12 files · 30 chunks')).toBeVisible();
    });

    it('keeps an unavailable workspace as a persistent launcher row', async () => {
        mocks.authorized.mockResolvedValue(false);
        render(<LandingScreen onIndexed={vi.fn()} />);
        await waitFor(() => expect(screen.getAllByText('Workspace unavailable').length).toBeGreaterThan(0));
        expect(screen.getByText(/choose this folder again/i)).toBeVisible();
    });

    it('shows an honest index-required state', async () => {
        mocks.authorized.mockResolvedValue(true);
        mocks.health.mockResolvedValue({ ...ready, status: 'not_indexed', fileCount: 0, chunkCount: 0, embeddingModel: null });
        render(<LandingScreen onIndexed={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('Index required')).toBeVisible());
    });

    it('re-authorizes a known ready workspace without forcing reindexing', async () => {
        const opened = vi.fn();
        mocks.authorized.mockResolvedValue(false);
        mocks.health.mockResolvedValue(ready);
        mocks.select.mockResolvedValue('C:/workspace-a');
        render(<LandingScreen onIndexed={opened} />);
        await userEvent.click(screen.getByRole('button', { name: 'Open workspace…' }));
        await userEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
        await waitFor(() => expect(opened).toHaveBeenCalledWith(expect.objectContaining({ id: 'C:/workspace-a' })));
        expect(screen.queryByRole('button', { name: 'Index workspace' })).not.toBeInTheDocument();
    });
});
