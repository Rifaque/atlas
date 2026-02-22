import { v4 as uuidv4 } from 'uuid';

export interface CitationRef {
    filePath: string;
    lineRangeStart?: number;
    lineRangeEnd?: number;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    citations?: string[];
    citationRefs?: CitationRef[];
    followUpSuggestions?: string[];
}

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: number;
    messages: ChatMessage[];
    manualContext?: string[];
}

const CHATS_KEY = 'atlas_chats';

export async function loadChats(): Promise<ChatSession[]> {
    try {
        const raw = localStorage.getItem(CHATS_KEY);
        if (raw) {
            const chats = JSON.parse(raw) as ChatSession[];
            return chats.sort((a, b) => b.updatedAt - a.updatedAt);
        }
    } catch (err) {
        console.error('Failed to load chats from localStorage', err);
    }
    return [];
}

export async function saveChat(chat: ChatSession): Promise<void> {
    chat.updatedAt = Date.now();

    // Auto generate title if empty or default
    if (!chat.title || chat.title === 'New Chat') {
        const firstUser = chat.messages.find(m => m.role === 'user');
        if (firstUser) {
            chat.title = firstUser.content.substring(0, 30) + (firstUser.content.length > 30 ? '...' : '');
        }
    }

    try {
        const raw = localStorage.getItem(CHATS_KEY);
        let chats: ChatSession[] = raw ? JSON.parse(raw) : [];
        const idx = chats.findIndex(c => c.id === chat.id);
        if (idx >= 0) {
            chats[idx] = chat;
        } else {
            chats.push(chat);
        }

        // Keep only top 50 chats to save space
        chats.sort((a, b) => b.updatedAt - a.updatedAt);
        if (chats.length > 50) chats = chats.slice(0, 50);

        localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    } catch (e) {
        console.error('Failed to save chat to localStorage', e);
    }
}

export async function deleteChat(id: string): Promise<void> {
    try {
        const raw = localStorage.getItem(CHATS_KEY);
        if (raw) {
            let chats = JSON.parse(raw) as ChatSession[];
            chats = chats.filter(c => c.id !== id);
            localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        }
    } catch (err) {
        console.error("Failed to delete chat", err);
    }
}

export async function renameChat(chat: ChatSession, newTitle: string): Promise<void> {
    chat.title = newTitle;
    await saveChat(chat);
}

export function createNewChat(): ChatSession {
    return {
        id: uuidv4(),
        title: 'New Chat',
        updatedAt: Date.now(),
        messages: []
    };
}

