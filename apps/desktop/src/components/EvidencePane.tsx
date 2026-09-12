import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, Pin, Trash2, X } from 'lucide-react';
import type { EvidenceRef } from '../lib/chats';
import type { FileNode } from '../lib/api';
import { displayPath } from '../lib/paths';
import { FileTree } from './FileTree';
import { InlineFileViewer } from './InlineFileViewer';
import { Button, IconButton, InlineAlert } from './ui';

export type EvidenceTab = 'sources' | 'files' | 'context';
export interface EvidenceSelection { filePath: string; lineStart?: number; lineEnd?: number; }

export function EvidencePane({
    workspaceId,
    tab,
    onTab,
    sources,
    selection,
    tree,
    pinned,
    unavailable,
    includeGitContext,
    width,
    overlay,
    onWidth,
    onSelect,
    onPin,
    onUnpin,
    onClear,
    onUnavailable,
    onClose,
}: {
    workspaceId: string;
    tab: EvidenceTab;
    onTab: (tab: EvidenceTab) => void;
    sources: EvidenceRef[];
    selection: EvidenceSelection | null;
    tree: FileNode[];
    pinned: string[];
    unavailable: Set<string>;
    includeGitContext: boolean;
    width: number;
    overlay: boolean;
    onWidth: (width: number) => void;
    onSelect: (target: EvidenceSelection) => void;
    onPin: (path: string) => void;
    onUnpin: (path: string) => void;
    onClear: () => void;
    onUnavailable: (path: string) => void;
    onClose: () => void;
}) {
    const [dragging, setDragging] = useState(false);
    const resize = useCallback((event: PointerEvent) => {
        onWidth(Math.max(360, Math.min(520, window.innerWidth - event.clientX)));
    }, [onWidth]);
    useEffect(() => {
        if (!dragging) return;
        window.addEventListener('pointermove', resize);
        const stop = () => setDragging(false);
        window.addEventListener('pointerup', stop, { once: true });
        return () => { window.removeEventListener('pointermove', resize); window.removeEventListener('pointerup', stop); };
    }, [dragging, resize]);

    const selectedSourceIndex = sources.findIndex(source => source.filePath === selection?.filePath && source.lineStart === selection?.lineStart);
    const selectSource = (source: EvidenceRef) => onSelect({ filePath: source.filePath, lineStart: source.lineStart, lineEnd: source.lineEnd });
    const beginResize = (event: ReactPointerEvent) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); };

    return (
        <aside className={`evidence-pane ${overlay ? 'is-overlay' : ''}`} style={{ '--evidence-width': `${width}px` } as CSSProperties} aria-label="Evidence and files">
            {!overlay && <div className="evidence-resizer" role="separator" aria-orientation="vertical" aria-label="Resize evidence pane" onPointerDown={beginResize} />}
            <header className="evidence-pane__header">
                <div className="evidence-tabs" role="tablist" aria-label="Evidence views">
                    {(['sources', 'files', 'context'] as EvidenceTab[]).map(item => (
                        <button role="tab" aria-selected={tab === item} key={item} onClick={() => onTab(item)}>{item === 'context' ? `Context${pinned.length ? ` ${pinned.length}` : ''}` : item[0].toUpperCase() + item.slice(1)}</button>
                    ))}
                </div>
                <IconButton label="Close evidence" onClick={onClose}><X size={16} /></IconButton>
            </header>

            {tab === 'sources' && (
                <div className="evidence-pane__body">
                    {!sources.length ? <p className="panel-empty">Select a citation or Find result to inspect its source.</p> : (
                        <div className="citation-list" role="listbox" aria-label="Sources">
                            {sources.map((source, index) => (
                                <button role="option" aria-selected={selectedSourceIndex === index} key={source.id} onClick={() => selectSource(source)}>
                                    <span className="source-number">{index + 1}</span>
                                    <span className="citation-list__path mono">{source.displayPath}</span>
                                    <span>{source.sourceType === 'pinned_workspace_file' ? 'Pinned' : 'Retrieved'}</span>
                                    <span>Lines {source.lineStart}–{source.lineEnd}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {sources.length > 1 && selectedSourceIndex >= 0 && (
                        <div className="source-pager">
                            <IconButton label="Previous source" disabled={selectedSourceIndex === 0} onClick={() => selectSource(sources[selectedSourceIndex - 1])}><ChevronLeft size={15} /></IconButton>
                            <span>{selectedSourceIndex + 1} of {sources.length}</span>
                            <IconButton label="Next source" disabled={selectedSourceIndex === sources.length - 1} onClick={() => selectSource(sources[selectedSourceIndex + 1])}><ChevronRight size={15} /></IconButton>
                        </div>
                    )}
                    {selection && <InlineFileViewer workspacePath={workspaceId} {...selection} pinned={pinned.includes(selection.filePath)} onPin={() => onPin(selection.filePath)} onUnavailable={onUnavailable} />}
                </div>
            )}

            {tab === 'files' && (
                <div className="evidence-pane__body evidence-pane__files">
                    <FileTree nodes={tree} pinnedFiles={pinned} onPinFile={onPin} onOpenFile={filePath => onSelect({ filePath })} />
                    {selection && <InlineFileViewer workspacePath={workspaceId} {...selection} pinned={pinned.includes(selection.filePath)} onPin={() => onPin(selection.filePath)} onUnavailable={onUnavailable} />}
                </div>
            )}

            {tab === 'context' && (
                <div className="context-basket">
                    <div className="context-basket__intro">
                        <p>Pinned files influence answers in this chat. Atlas applies a bounded character budget when building the prompt.</p>
                        {pinned.length > 0 && <Button variant="quiet" size="small" onClick={onClear}><Trash2 size={13} /> Clear all</Button>}
                    </div>
                    {!pinned.length ? <p className="panel-empty">Pin files from Sources, Files, or Find.</p> : pinned.map(path => (
                        <div className="context-row" key={path}>
                            <button onClick={() => onSelect({ filePath: path })}>
                                <strong>{path.split(/[/\\]/).pop()}</strong>
                                <span className="mono">{displayPath(path)}</span>
                            </button>
                            {unavailable.has(path) && <InlineAlert tone="warning" title="File unavailable">This item will not be readable until the workspace file is restored.</InlineAlert>}
                            <div>
                                <IconButton label={`Copy path for ${path}`} onClick={() => void navigator.clipboard.writeText(path)}><Clipboard size={13} /></IconButton>
                                <IconButton label={`Remove ${path} from context`} onClick={() => onUnpin(path)}><X size={13} /></IconButton>
                            </div>
                        </div>
                    ))}
                    {selection && pinned.includes(selection.filePath) && <InlineFileViewer workspacePath={workspaceId} {...selection} pinned onUnavailable={onUnavailable} />}
                    <div className="context-basket__foot"><Pin size={13} /> {pinned.length} file{pinned.length === 1 ? '' : 's'} pinned to this chat{includeGitContext ? ' · Git context included' : ''}</div>
                </div>
            )}
        </aside>
    );
}
