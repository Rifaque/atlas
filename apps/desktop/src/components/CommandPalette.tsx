import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Search, MessageSquare, FileText
} from 'lucide-react';
import type { ChatSession } from '../lib/chats';
import type { FileNode } from '../lib/api';

export interface CommandPaletteAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    category: 'action';
    onSelect: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: ChatSession[];
    fileTree: FileNode[];
    onSelectChat: (session: ChatSession) => void;
    onOpenFile: (filePath: string) => void;
    actions: CommandPaletteAction[];
}

interface PaletteItem {
    id: string;
    label: string;
    detail?: string;
    icon: React.ReactNode;
    category: 'chat' | 'file' | 'action';
    onSelect: () => void;
}

function flattenFileTree(nodes: FileNode[], prefix = ''): { name: string; path: string }[] {
    const result: { name: string; path: string }[] = [];
    for (const node of nodes) {
        if (node.type === 'file') {
            result.push({ name: node.name, path: node.path });
        }
        if (node.children) {
            result.push(...flattenFileTree(node.children, prefix + node.name + '/'));
        }
    }
    return result;
}

function fuzzyMatch(query: string, text: string): boolean {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length;
}

const CATEGORY_ORDER = { action: 0, chat: 1, file: 2 };
const CATEGORY_LABELS = { action: '⚡ Actions', chat: '💬 Chats', file: '📄 Files' };

export function CommandPalette({ isOpen, onClose, sessions, fileTree, onSelectChat, onOpenFile, actions }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Build all items
    const allItems = useMemo<PaletteItem[]>(() => {
        const items: PaletteItem[] = [];

        // Actions
        for (const action of actions) {
            items.push({
                id: `action-${action.id}`,
                label: action.label,
                icon: action.icon,
                category: 'action',
                onSelect: action.onSelect,
            });
        }

        // Chats
        for (const session of sessions) {
            if (session.messages.length === 0 && session.title === 'New Chat') continue;
            items.push({
                id: `chat-${session.id}`,
                label: session.title,
                detail: `${session.messages.length} messages`,
                icon: <MessageSquare size={14} className="text-accent" />,
                category: 'chat',
                onSelect: () => onSelectChat(session),
            });
        }

        // Files
        const files = flattenFileTree(fileTree);
        for (const file of files.slice(0, 200)) { // cap to prevent performance issues
            items.push({
                id: `file-${file.path}`,
                label: file.name,
                detail: file.path,
                icon: <FileText size={14} className="text-text-secondary" />,
                category: 'file',
                onSelect: () => onOpenFile(file.path),
            });
        }

        return items;
    }, [sessions, fileTree, actions, onSelectChat, onOpenFile]);

    // Filter items
    const filtered = useMemo(() => {
        if (!query.trim()) return allItems.slice(0, 50);
        return allItems
            .filter(item => fuzzyMatch(query, item.label) || (item.detail && fuzzyMatch(query, item.detail)))
            .slice(0, 50);
    }, [query, allItems]);

    // Group by category
    const grouped = useMemo(() => {
        const groups: { category: PaletteItem['category']; items: PaletteItem[] }[] = [];
        const seen = new Set<string>();
        const sorted = [...filtered].sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);

        for (const item of sorted) {
            if (!seen.has(item.category)) {
                groups.push({ category: item.category, items: [] });
                seen.add(item.category);
            }
            groups[groups.length - 1].items.push(item);
        }
        return groups;
    }, [filtered]);

    // Flat list for keyboard nav
    const flatFiltered = useMemo(() => grouped.flatMap(g => g.items), [grouped]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Keep selection in view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, flatFiltered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatFiltered[selectedIndex]) {
                flatFiltered[selectedIndex].onSelect();
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [flatFiltered, selectedIndex, onClose]);

    // Reset selection when query changes
    useEffect(() => { setSelectedIndex(0); }, [query]);

    if (!isOpen) return null;

    let flatIdx = 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

            {/* Modal */}
            <div
                className="relative w-full max-w-lg mx-4 bg-bg-surface border border-border-default rounded-xl shadow-2xl animate-in scale-in duration-200 overflow-hidden"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                    <Search size={16} className="text-text-muted shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search chats, files, actions…"
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    <kbd className="text-[10px] text-text-muted bg-bg-inset px-1.5 py-0.5 rounded border border-border-subtle font-mono">Esc</kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
                    {flatFiltered.length === 0 ? (
                        <div className="py-8 text-center text-sm text-text-muted">
                            No results for &quot;{query}&quot;
                        </div>
                    ) : (
                        grouped.map(group => (
                            <div key={group.category}>
                                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                    {CATEGORY_LABELS[group.category]}
                                </div>
                                {group.items.map(item => {
                                    const idx = flatIdx++;
                                    return (
                                        <button
                                            key={item.id}
                                            data-idx={idx}
                                            onClick={() => { item.onSelect(); onClose(); }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${idx === selectedIndex
                                                ? 'bg-accent-muted text-text-primary'
                                                : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'
                                                }`}
                                        >
                                            <span className="shrink-0">{item.icon}</span>
                                            <span className="flex-1 truncate">{item.label}</span>
                                            {item.detail && (
                                                <span className="text-[10px] text-text-muted truncate max-w-[200px]">{item.detail}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hints */}
                <div className="px-4 py-2 border-t border-border-subtle flex items-center gap-3 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1"><kbd className="bg-bg-inset px-1 py-0.5 rounded border border-border-subtle font-mono">↑↓</kbd> navigate</span>
                    <span className="flex items-center gap-1"><kbd className="bg-bg-inset px-1 py-0.5 rounded border border-border-subtle font-mono">↵</kbd> select</span>
                    <span className="flex items-center gap-1"><kbd className="bg-bg-inset px-1 py-0.5 rounded border border-border-subtle font-mono">Esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
}
