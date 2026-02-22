import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus } from 'lucide-react';
import type { FileNode } from '../lib/api';

interface FileTreeProps {
    nodes: FileNode[];
    pinnedFiles?: string[];
    onPinFile: (path: string) => void;
    onOpenFile: (path: string) => void;
}

function TreeNode({ node, pinnedFiles, onPinFile, onOpenFile, depth }: {
    node: FileNode;
    pinnedFiles?: string[];
    onPinFile: (path: string) => void;
    onOpenFile: (path: string) => void;
    depth: number;
}) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isPinned = pinnedFiles?.includes(node.path);

    if (node.type === 'dir') {
        return (
            <div>
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[rgba(255,255,255,0.04)] text-text-secondary hover:text-text-primary transition-colors text-left group"
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                >
                    {expanded
                        ? <ChevronDown size={12} className="shrink-0 opacity-60" />
                        : <ChevronRight size={12} className="shrink-0 opacity-60" />
                    }
                    {expanded
                        ? <FolderOpen size={13} className="shrink-0 text-yellow-400/70" />
                        : <Folder size={13} className="shrink-0 text-yellow-400/70" />
                    }
                    <span className="truncate text-xs">{node.name}</span>
                </button>
                {expanded && node.children && (
                    <div>
                        {node.children.map(child => (
                            <TreeNode key={child.path} node={child} pinnedFiles={pinnedFiles} onPinFile={onPinFile} onOpenFile={onOpenFile} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[rgba(255,255,255,0.04)] group transition-colors cursor-pointer"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => onOpenFile(node.path)}
        >
            <FileText size={12} className={`shrink-0 ${isPinned ? 'text-accent' : 'text-text-secondary/60'}`} />
            <span className="truncate text-xs text-text-secondary group-hover:text-text-primary transition-colors flex-1">{node.name}</span>
            {!isPinned && (
                <button
                    onClick={e => { e.stopPropagation(); onPinFile(node.path); }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 hover:text-accent transition-all text-text-secondary"
                    title="Add to Context"
                >
                    <Plus size={11} />
                </button>
            )}
        </div>
    );
}

export function FileTree({ nodes, pinnedFiles, onPinFile, onOpenFile }: FileTreeProps) {
    if (nodes.length === 0) return (
        <div className="text-xs text-text-secondary/40 text-center py-4">No indexed files found.</div>
    );

    return (
        <div className="text-sm">
            {nodes.map(node => (
                <TreeNode key={node.path} node={node} pinnedFiles={pinnedFiles} onPinFile={onPinFile} onOpenFile={onOpenFile} depth={0} />
            ))}
        </div>
    );
}
