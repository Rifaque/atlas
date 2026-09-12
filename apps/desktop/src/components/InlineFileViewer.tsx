import { useEffect, useRef, useState } from 'react';
import { Clipboard, FileWarning, Pin, Rows3 } from 'lucide-react';
import { fetchFileContent } from '../lib/api';
import { displayPath } from '../lib/paths';
import { Button, EmptyState, InlineAlert, Spinner } from './ui';

interface InlineFileViewerProps {
    workspacePath: string;
    filePath: string;
    lineStart?: number;
    lineEnd?: number;
    pinned?: boolean;
    onPin?: () => void;
    onUnavailable?: (path: string) => void;
}

export function InlineFileViewer({ workspacePath, filePath, lineStart, lineEnd, pinned, onPin, onUnavailable }: InlineFileViewerProps) {
    const [result, setResult] = useState<{ path: string; content: string | null; totalLines: number; error: string | null } | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        fetchFileContent(workspacePath, filePath)
            .then(next => {
                if (!active) return;
                setResult({ path: filePath, content: next.content, totalLines: next.totalLines, error: null });
            })
            .catch((cause: unknown) => {
                if (!active) return;
                const message = cause instanceof Error ? cause.message : String(cause);
                setResult({ path: filePath, content: null, totalLines: 0, error: message });
                onUnavailable?.(filePath);
            })
        return () => { active = false; };
    }, [filePath, onUnavailable, workspacePath]);

    useEffect(() => {
        if (result?.path === filePath && result.content && lineStart !== undefined && contentRef.current) {
            const target = contentRef.current.querySelector<HTMLElement>(`[data-line="${lineStart}"]`);
            if (target) {
                contentRef.current.scrollTop = Math.max(0, target.offsetTop - contentRef.current.clientHeight / 2);
            }
        }
    }, [filePath, lineStart, result]);

    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const isLoading = result?.path !== filePath;
    const content = result?.content ?? null;
    const totalLines = result?.totalLines ?? 0;
    const error = result?.error ?? null;
    const staleRange = lineStart !== undefined && (lineStart < 1 || lineStart > totalLines);

    if (isLoading) return <div className="source-preview__state"><Spinner label={`Loading ${fileName}`} size={20} /> Loading {fileName}…</div>;
    if (error) return <EmptyState icon={<FileWarning size={18} />} title="File unavailable"><p>{error}</p></EmptyState>;
    if (content === null) return null;

    return (
        <section className="source-preview" aria-label={`Preview ${fileName}`}>
            <header className="source-preview__header">
                <div className="source-preview__path">
                    <strong>{fileName}</strong>
                    <span className="mono" title={displayPath(filePath)}>{displayPath(filePath)}</span>
                </div>
                <div className="source-preview__actions">
                    {onPin && <Button size="small" variant="quiet" onClick={onPin}><Pin size={13} /> {pinned ? 'Pinned' : 'Pin'}</Button>}
                    <Button size="small" variant="quiet" onClick={() => void navigator.clipboard.writeText(filePath)}><Clipboard size={13} /> Copy path</Button>
                </div>
            </header>
            {staleRange && (
                <InlineAlert tone="warning" title="Source range changed">
                    The indexed range starts at line {lineStart}, but this file now has {totalLines} lines. Refresh the index to update citations.
                </InlineAlert>
            )}
            <div className="source-preview__meta"><Rows3 size={13} /> {totalLines} lines{lineStart && !staleRange ? ` · showing ${lineStart}–${Math.min(lineEnd ?? lineStart, totalLines)}` : ''}</div>
            <div className="source-code" ref={contentRef} tabIndex={0} aria-label={`${fileName} source code`}>
                {content.split('\n').map((line, index) => {
                    const number = index + 1;
                    const inRange = !staleRange && lineStart !== undefined && number >= lineStart && number <= (lineEnd ?? lineStart);
                    return (
                        <div className={`source-line ${inRange ? 'is-highlighted' : ''}`} data-line={number} key={number}>
                            <span className="source-line__number" aria-hidden="true">{number}</span>
                            <span className="source-line__text">{line || ' '}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
