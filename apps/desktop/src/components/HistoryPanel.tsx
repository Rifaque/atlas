import { useMemo, useState } from 'react';
import { Download, Edit3, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';
import type { ChatSession } from '../lib/chats';
import { Button, IconButton } from './ui';

type Group = { label: string; sessions: ChatSession[] };

function groupSessions(sessions: ChatSession[], now = Date.now()): Group[] {
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const weekAgo = startToday.getTime() - 6 * 24 * 60 * 60 * 1000;
    const groups: Group[] = [
        { label: 'Today', sessions: [] },
        { label: 'Previous 7 days', sessions: [] },
        { label: 'Earlier', sessions: [] },
    ];
    for (const session of sessions) {
        if (session.updatedAt >= startToday.getTime()) groups[0].sessions.push(session);
        else if (session.updatedAt >= weekAgo) groups[1].sessions.push(session);
        else groups[2].sessions.push(session);
    }
    return groups.filter(group => group.sessions.length);
}

export function HistoryPanel({
    sessions,
    activeSessionId,
    expanded,
    generating,
    onToggle,
    onNew,
    onSelect,
    onRename,
    onDelete,
    onExport,
}: {
    sessions: ChatSession[];
    activeSessionId: string;
    expanded: boolean;
    generating: boolean;
    onToggle: () => void;
    onNew: () => void;
    onSelect: (session: ChatSession) => void;
    onRename: (session: ChatSession, title: string) => void;
    onDelete: (id: string) => void;
    onExport: (session: ChatSession) => void;
}) {
    const groups = useMemo(() => groupSessions(sessions), [sessions]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const disabledTitle = generating ? 'Finish or stop generation before changing chats' : undefined;

    return (
        <aside className={`history-panel ${expanded ? 'is-expanded' : ''}`} aria-label="Workspace history">
            <div className="history-panel__top">
                <IconButton label={expanded ? 'Collapse history' : 'Expand history'} onClick={onToggle}>
                    {expanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
                </IconButton>
                {expanded && <strong>History</strong>}
            </div>
            <div className="history-panel__new">
                {expanded ? (
                    <Button variant="secondary" size="small" onClick={onNew} disabled={generating} title={disabledTitle}>
                        <MessageSquarePlus size={14} /> New chat
                    </Button>
                ) : (
                    <IconButton label="New chat" onClick={onNew} disabled={generating} title={disabledTitle}>
                        <MessageSquarePlus size={17} />
                    </IconButton>
                )}
            </div>
            {expanded && (
                <div className="history-panel__list">
                    {groups.length === 0 && <p className="history-empty">No saved conversations yet.</p>}
                    {groups.map(group => (
                        <section key={group.label} aria-labelledby={`history-${group.label.replace(/\s/g, '-').toLowerCase()}`}>
                            <h2 id={`history-${group.label.replace(/\s/g, '-').toLowerCase()}`}>{group.label}</h2>
                            {group.sessions.map(session => (
                                <div className={`history-row ${session.id === activeSessionId ? 'is-active' : ''}`} key={session.id}>
                                    {editingId === session.id ? (
                                        <input
                                            aria-label="Conversation title"
                                            autoFocus
                                            value={draftTitle}
                                            onChange={event => setDraftTitle(event.target.value)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter') {
                                                    onRename(session, draftTitle.trim() || session.title);
                                                    setEditingId(null);
                                                }
                                                if (event.key === 'Escape') setEditingId(null);
                                            }}
                                            onBlur={() => {
                                                onRename(session, draftTitle.trim() || session.title);
                                                setEditingId(null);
                                            }}
                                        />
                                    ) : (
                                        <button className="history-row__title" disabled={generating} title={disabledTitle ?? session.title} onClick={() => onSelect(session)}>
                                            {session.title}
                                        </button>
                                    )}
                                    <div className="history-row__actions">
                                        <IconButton label={`Rename ${session.title}`} disabled={generating} onClick={() => { setEditingId(session.id); setDraftTitle(session.title); }}><Edit3 size={13} /></IconButton>
                                        <IconButton label={`Export ${session.title}`} onClick={() => onExport(session)}><Download size={13} /></IconButton>
                                        <IconButton label={`Delete ${session.title}`} disabled={generating} onClick={() => onDelete(session.id)}><Trash2 size={13} /></IconButton>
                                    </div>
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            )}
        </aside>
    );
}
