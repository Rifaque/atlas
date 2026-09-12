import { useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Pin } from 'lucide-react';
import type { FileNode } from '../lib/api';
import { IconButton } from './ui';

interface FileTreeProps {
    nodes: FileNode[];
    pinnedFiles?: string[];
    onPinFile: (path: string) => void;
    onOpenFile: (path: string) => void;
}

function focusSibling(event: KeyboardEvent<HTMLButtonElement>, direction: 1 | -1) {
    const tree = event.currentTarget.closest('[role="tree"]');
    const items = Array.from(tree?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]') ?? []);
    const index = items.indexOf(event.currentTarget);
    items[index + direction]?.focus();
}

function TreeNode({ node, pinnedFiles = [], onPinFile, onOpenFile, depth }: FileTreeProps & { node: FileNode; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isDirectory = node.type === 'directory';
    const isPinned = pinnedFiles.includes(node.path);
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); focusSibling(event, 1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); focusSibling(event, -1); }
        if (isDirectory && event.key === 'ArrowRight') { event.preventDefault(); setExpanded(true); }
        if (isDirectory && event.key === 'ArrowLeft') { event.preventDefault(); setExpanded(false); }
    };

    return (
        <div role="none">
            <div className="file-tree-row" style={{ paddingLeft: 6 + depth * 14 }}>
                <button
                    type="button"
                    role="treeitem"
                    aria-level={depth + 1}
                    aria-expanded={isDirectory ? expanded : undefined}
                    className="file-tree-row__main"
                    onKeyDown={onKeyDown}
                    onClick={() => isDirectory ? setExpanded(value => !value) : onOpenFile(node.path)}
                >
                    {isDirectory ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="file-tree-spacer" />}
                    {isDirectory ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <FileText size={14} />}
                    <span>{node.name}</span>
                </button>
                {!isDirectory && (
                    <IconButton label={isPinned ? `${node.name} is pinned` : `Pin ${node.name}`} disabled={isPinned} onClick={() => onPinFile(node.path)}>
                        <Pin size={12} />
                    </IconButton>
                )}
            </div>
            {isDirectory && expanded && node.children && (
                <div role="group">
                    {node.children.map(child => <TreeNode key={child.path} node={child} nodes={[]} pinnedFiles={pinnedFiles} onPinFile={onPinFile} onOpenFile={onOpenFile} depth={depth + 1} />)}
                </div>
            )}
        </div>
    );
}

export function FileTree(props: FileTreeProps) {
    if (!props.nodes.length) return <p className="panel-empty">No supported files found.</p>;
    return (
        <div className="file-tree" role="tree" aria-label="Workspace files">
            {props.nodes.map(node => <TreeNode key={node.path} {...props} node={node} depth={0} />)}
        </div>
    );
}
