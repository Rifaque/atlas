import { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, Loader2, Code2 } from 'lucide-react';
import { fetchFileContent } from '../lib/api';
import { open as openShell } from '@tauri-apps/plugin-shell';

interface InlineFileViewerProps {
    filePath: string;
    lineStart?: number;
    onClose: () => void;
}

export function InlineFileViewer({ filePath, lineStart, onClose }: InlineFileViewerProps) {
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetchFileContent(filePath)
            .then(res => {
                if (!res) throw new Error('File not found or empty');
                setContent(res);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [filePath]);

    useEffect(() => {
        if (!isLoading && content && lineStart && contentRef.current) {
            const lineEl = document.getElementById(`line-${lineStart}`);
            if (lineEl) {
                lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [isLoading, content, lineStart]);

    const handleOpenInSystem = async () => {
        try {
            // Convert Windows path (C:\foo\bar) to a file:// URI (file:///C:/foo/bar)
            const normalized = filePath.replace(/\\/g, '/');
            const fileUri = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
            await openShell(fileUri);
        } catch (err) {
            console.error('Failed to open file in system:', err);
        }
    };

    const handleOpenInVSCode = async () => {
        try {
            const { Command } = await import('@tauri-apps/plugin-shell');
            await Command.create('code', [filePath]).execute();
        } catch (err) {
            console.error('Failed to open in VS Code:', err);
        }
    };

    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    // A simple syntax highlighter wrapper
    const renderContent = () => {
        if (!content) return null;
        const lines = content.split('\n');

        return (
            <div className="font-mono text-xs leading-relaxed" ref={contentRef}>
                {lines.map((line, i) => {
                    const lineNum = i + 1;
                    const isFocus = lineStart && Math.abs(lineNum - lineStart) <= 5;
                    const isTarget = lineStart === lineNum;

                    return (
                        <div
                            key={i}
                            id={`line-${lineNum}`}
                            className={`flex group transition-colors px-4
                                ${isTarget ? 'bg-accent/20 border-l-2 border-accent' :
                                    isFocus ? 'bg-[var(--border-subtle)] border-l-2 border-transparent' :
                                        'hover:bg-[var(--border-subtle)] border-l-2 border-transparent'}`}
                        >
                            <span className="w-10 shrink-0 text-text-secondary/30 text-right pr-4 select-none group-hover:text-text-secondary/60">
                                {lineNum}
                            </span>
                            <span className="whitespace-pre flex-1 truncate max-w-full text-text-secondary">
                                {line || ' '}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-12 animate-in fade-in duration-200">
            <div className="bg-bg-main border border-glass-border shadow-2xl rounded-xl w-full max-w-6xl h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated border-b border-glass-border">
                    <div className="flex items-center gap-3 truncate">
                        <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20">
                            <Code2 size={16} className="text-accent" />
                        </div>
                        <div className="flex flex-col truncate">
                            <span className="text-sm font-semibold text-text-primary truncate">{fileName}</span>
                            <span className="text-[10px] text-text-secondary truncate opacity-60 flex items-center gap-1">
                                {filePath} {lineStart && <span className="text-accent ml-1 px-1 rounded bg-accent/10">Line {lineStart}</span>}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleOpenInVSCode}
                            title="Open in VS Code"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[#1e88e5] hover:bg-[#1e88e5]/10 bg-[#1e88e5]/5 border border-[#1e88e5]/20 text-xs font-semibold transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" /></svg>
                            VS Code
                        </button>
                        <button
                            onClick={handleOpenInSystem}
                            title="Open in default OS editor"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-bg-surface-hover text-xs text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ExternalLink size={14} /> Open
                        </button>
                        <div className="w-px h-4 bg-glass-border mx-1" />
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-text-secondary transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto bg-[var(--code-bg)] selection:bg-accent/30 py-4">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-text-secondary/50 gap-4">
                            <Loader2 size={24} className="animate-spin text-accent" />
                            <span className="text-xs">Loading {fileName}…</span>
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center text-red-400 gap-2">
                            <span className="text-sm font-semibold">Could not load file</span>
                            <span className="text-xs opacity-80">{error}</span>
                        </div>
                    ) : (
                        renderContent()
                    )}
                </div>
            </div>
        </div>
    );
}
