import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveWorkspace, loadWorkspaces } from './workspaces';

describe('single workspace persistence', () => {
    const values = new Map<string, string>();
    beforeEach(() => {
        values.clear();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        });
    });

    it('migrates the legacy active array to one canonical path identity', () => {
        values.set('atlas_workspaces', JSON.stringify([{
            id: 'random-uuid', name: 'A', folderPath: 'C:/workspace-a', model: 'nomic-embed-text', indexedAt: 1,
        }]));
        values.set('atlas_active_workspaces', JSON.stringify(['random-uuid', 'another-id']));
        const workspaces = loadWorkspaces();
        expect(workspaces[0].id).toBe('C:/workspace-a');
        expect(workspaces[0].embeddingModel).toBe('nomic-embed-text');
        expect(getActiveWorkspace()?.id).toBe('C:/workspace-a');
    });
});
