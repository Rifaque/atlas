import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewChat, loadActiveChatId, loadChats, saveChat, setActiveChatId } from './chats';

describe('workspace history persistence', () => {
    const values = new Map<string, string>();

    beforeEach(() => {
        values.clear();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        });
        vi.stubGlobal('crypto', { randomUUID: () => 'session-id' });
    });

    it('isolates history and pinned context by workspace across reloads', async () => {
        const session = createNewChat('C:/workspace-a');
        session.messages.push({ role: 'user', content: 'A only' });
        session.manualContext.push('C:/workspace-a/private.ts');
        await saveChat(session);

        expect((await loadChats('C:/workspace-b'))).toEqual([]);
        const restored = await loadChats('C:/workspace-a');
        expect(restored[0].messages[0].content).toBe('A only');
        expect(restored[0].manualContext).toEqual(['C:/workspace-a/private.ts']);
        expect(loadActiveChatId('C:/workspace-a')).toBe(session.id);
    });

    it('persists the active session independently for each workspace', async () => {
        const first = { ...createNewChat('C:/workspace-a'), id: 'first' };
        const second = { ...createNewChat('C:/workspace-a'), id: 'second' };
        await saveChat(first);
        await saveChat(second);
        setActiveChatId('C:/workspace-a', first.id);

        expect(loadActiveChatId('C:/workspace-a')).toBe('first');
        expect(loadActiveChatId('C:/workspace-b')).toBeNull();
    });

    it('recovers unscoped legacy sessions into the legacy active workspace', async () => {
        values.set('atlas_workspaces', JSON.stringify([{ id: 'old-id', folderPath: 'C:/workspace-a' }]));
        values.set('atlas_active_workspace', JSON.stringify('old-id'));
        values.set('atlas_chats', JSON.stringify([{
            id: 'legacy-global', title: 'Recovered', updatedAt: 1,
            messages: [{ role: 'user', content: 'keep me' }], manualContext: ['C:/workspace-a/a.ts'],
        }]));

        expect((await loadChats('C:/workspace-a'))[0].id).toBe('legacy-global');
        expect(await loadChats('C:/workspace-b')).toEqual([]);
    });

    it('migrates scoped legacy sessions and ignores corrupt state without throwing', async () => {
        values.set('atlas_chats', JSON.stringify([{
            id: 'legacy', workspaceId: 'C:/workspace-a', title: 'Legacy', updatedAt: 1,
            messages: [{ role: 'user', content: 'recovered' }], manualContext: [],
        }]));
        expect((await loadChats('C:/workspace-a'))[0].id).toBe('legacy');

        values.clear();
        values.set('atlas_history_v2', '{broken');
        values.set('atlas_chats', '{also broken');
        await expect(loadChats('C:/workspace-a')).resolves.toEqual([]);
    });
});
