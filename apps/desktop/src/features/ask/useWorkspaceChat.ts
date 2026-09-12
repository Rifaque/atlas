import { useCallback, useRef, useState } from 'react';
import { buildConversationHistory } from '../../lib/chatContext';
import type { ChatSession, EvidenceRef } from '../../lib/chats';
import { fetchGitContext, startChat, stopChat } from '../../lib/api';
import { CLOUD_DISCLOSURE_VERSION, type AtlasSettings } from '../../lib/settings';

interface UseWorkspaceChatOptions {
    workspaceId: string;
    embeddingModel: string;
    settings: AtlasSettings;
    session: ChatSession;
    updateSession: (update: (session: ChatSession) => ChatSession) => void;
    onError: (message: string) => void;
}

export function useWorkspaceChat({ workspaceId, embeddingModel, settings, session, updateSession, onError }: UseWorkspaceChatOptions) {
    const [input, setInput] = useState('');
    const [generating, setGenerating] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [preflightError, setPreflightError] = useState<string | null>(null);
    const activeEventId = useRef<string | null>(null);
    const unlistenRef = useRef<(() => void) | null>(null);
    const stopRequested = useRef(false);

    const stop = useCallback(async () => {
        if (!activeEventId.current) return;
        setStopping(true);
        stopRequested.current = true;
        try {
            await stopChat(activeEventId.current);
        } catch (error) {
            setStopping(false);
            onError(error instanceof Error ? error.message : String(error));
        }
    }, [onError]);

    const ask = useCallback(async (question: string) => {
        const query = question.trim();
        if (!query || generating) return;

        setPreflightError(null);
        if (settings.generationProvider === 'openrouter' && settings.cloudConsentVersion < CLOUD_DISCLOSURE_VERSION) {
            setPreflightError('OpenRouter is not enabled for this workspace. Review the cloud disclosure in Settings.');
            return;
        }

        setGenerating(true);
        setStopping(false);
        stopRequested.current = false;
        setInput('');
        const history = buildConversationHistory(session.messages);
        updateSession(current => ({
            ...current,
            messages: [
                ...current.messages,
                { role: 'user', content: query },
                { role: 'assistant', content: '', evidence: [], status: 'streaming' },
            ],
        }));

        let response = '';
        let evidence: EvidenceRef[] = [];
        try {
            let systemPrompt = settings.systemPrompt;
            const git = settings.includeGitContext ? await fetchGitContext(workspaceId) : null;
            if (git) {
                const summary = `Git context\nBranch: ${git.branch}\nChanged files: ${git.uncommitted_files.join(', ') || 'None'}\nRecent commits: ${git.recent_commits.join(' | ') || 'None'}\nDiff summary: ${git.diff_summary || 'None'}`;
                systemPrompt = systemPrompt ? `${systemPrompt}\n\n${summary}` : summary;
            }

            await startChat({
                query,
                model: settings.generationModel,
                provider: settings.generationProvider,
                ollamaHost: settings.ollamaHost,
                manualFiles: session.manualContext,
                systemPrompt,
                folderPath: workspaceId,
                history,
                embeddingModel,
                allowCloud: settings.generationProvider === 'openrouter',
            }, event => {
                if (event.type === 'citations') {
                    evidence = event.data ?? [];
                } else if (event.type === 'chunk') {
                    response += event.data?.chunk ?? '';
                    const marker = response.search(/(?:\n|^)\s*FOLLOW_UP_SUGGESTIONS\s*:/i);
                    const visible = marker >= 0 ? response.slice(0, marker).trimEnd() : response;
                    updateSession(current => ({
                        ...current,
                        messages: current.messages.map((message, index) => index === current.messages.length - 1
                            ? { ...message, content: visible, evidence }
                            : message),
                    }));
                } else if (event.type === 'suggestions') {
                    const suggestions = event.data?.suggestions ?? [];
                    updateSession(current => ({
                        ...current,
                        messages: current.messages.map((message, index) => index === current.messages.length - 1
                            ? { ...message, followUpSuggestions: suggestions }
                            : message),
                    }));
                } else if (event.type === 'error') {
                    const message = event.data?.error ?? 'Generation failed';
                    updateSession(current => ({
                        ...current,
                        messages: current.messages.map((item, index) => index === current.messages.length - 1
                            ? { ...item, status: 'failed', error: message }
                            : item),
                    }));
                    activeEventId.current = null;
                    unlistenRef.current?.();
                    unlistenRef.current = null;
                    setGenerating(false);
                    setStopping(false);
                    onError(message);
                } else if (event.type === 'done') {
                    const finalStatus = stopRequested.current ? 'stopped' : 'complete';
                    updateSession(current => ({
                        ...current,
                        messages: current.messages.map((item, index) => index === current.messages.length - 1
                            ? { ...item, status: finalStatus }
                            : item),
                    }));
                    activeEventId.current = null;
                    unlistenRef.current?.();
                    unlistenRef.current = null;
                    setGenerating(false);
                    setStopping(false);
                }
            }, (eventId, unlisten) => {
                activeEventId.current = eventId;
                unlistenRef.current = unlisten;
            });
        } catch (error) {
            activeEventId.current = null;
            unlistenRef.current?.();
            unlistenRef.current = null;
            setGenerating(false);
            setStopping(false);
            const message = error instanceof Error ? error.message : String(error);
            updateSession(current => ({
                ...current,
                messages: current.messages.map((item, index) => index === current.messages.length - 1
                    ? { ...item, status: 'failed', error: message }
                    : item),
            }));
            onError(message);
        }
    }, [embeddingModel, generating, onError, session.manualContext, session.messages, settings, updateSession, workspaceId]);

    return { input, setInput, generating, stopping, preflightError, clearPreflightError: () => setPreflightError(null), ask, stop };
}
