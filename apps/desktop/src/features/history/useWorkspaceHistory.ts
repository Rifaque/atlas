import { useCallback, useEffect, useState } from 'react';
import {
    createNewChat,
    deleteChat,
    loadActiveChatId,
    loadChats,
    renameChat,
    saveChat,
    setActiveChatId,
    type ChatSession,
} from '../../lib/chats';

export function useWorkspaceHistory(workspaceId: string) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSession, setActiveSession] = useState<ChatSession>(() => createNewChat(workspaceId));

    useEffect(() => {
        let active = true;
        loadChats(workspaceId).then(stored => {
            if (!active) return;
            const next = createNewChat(workspaceId);
            setSessions(stored);
            const activeId = loadActiveChatId(workspaceId);
            setActiveSession(stored.find(session => session.id === activeId) ?? stored[0] ?? next);
        });
        return () => { active = false; };
    }, [workspaceId]);

    const updateActive = useCallback((update: (session: ChatSession) => ChatSession) => {
        setActiveSession(current => {
            const candidate = update(current);
            const firstUser = candidate.messages.find(message => message.role === 'user');
            const next = {
                ...candidate,
                updatedAt: Date.now(),
                title: candidate.title === 'New Chat' && firstUser
                    ? `${firstUser.content.slice(0, 30)}${firstUser.content.length > 30 ? '…' : ''}`
                    : candidate.title,
            };
            void saveChat(next);
            setSessions(items => [next, ...items.filter(item => item.id !== next.id)]);
            return next;
        });
    }, []);

    const newSession = useCallback(() => {
        const next = createNewChat(workspaceId);
        setActiveSession(next);
    }, [workspaceId]);

    const selectSession = useCallback((session: ChatSession) => {
        if (session.workspaceId === workspaceId) {
            setActiveSession(session);
            setActiveChatId(workspaceId, session.id);
        }
    }, [workspaceId]);

    const removeSession = useCallback(async (id: string) => {
        await deleteChat(id, workspaceId);
        setSessions(items => items.filter(item => item.id !== id));
        setActiveSession(current => current.id === id ? createNewChat(workspaceId) : current);
    }, [workspaceId]);

    const renameSession = useCallback(async (session: ChatSession, title: string) => {
        if (session.workspaceId !== workspaceId) return;
        const next = { ...session, title };
        await renameChat(next, title);
        setSessions(items => items.map(item => item.id === next.id ? next : item));
        setActiveSession(current => current.id === next.id ? next : current);
    }, [workspaceId]);

    return { sessions, activeSession, updateActive, newSession, selectSession, removeSession, renameSession };
}
