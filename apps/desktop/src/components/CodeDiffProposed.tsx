import { useState } from 'react';
import { applyDiff } from '../lib/api';
import { Check, PencilLine, Code2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from '../lib/toast';

export interface CodeDiffProps {
    filepath: string;
    originalContent: string;
    newContent: string;
    language?: string;
}

export function CodeDiffProposed({ filepath, originalContent, newContent, language = 'text' }: CodeDiffProps) {
    const [isApplying, setIsApplying] = useState(false);
    const [applied, setApplied] = useState(false);
    const [view, setView] = useState<'diff' | 'new'>('new');

    const handleApply = async () => {
        setIsApplying(true);
        try {
            await applyDiff(filepath, originalContent || '', newContent);
            setApplied(true);
            toast(`Applied changes to ${filepath.split(/[/\\]/).pop()}`, 'success');
        } catch (e: any) {
            toast(`Failed to apply: ${e.message}`, 'error');
        }
        setIsApplying(false);
    };

    return (
        <div className="my-3 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between px-4 py-2 bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2">
                    <PencilLine size={14} className="text-accent" />
                    <span className="text-xs font-mono text-text-secondary">{filepath}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-bg-inset rounded p-0.5">
                        <button onClick={() => setView('diff')} className={`px-2 py-1 text-[10px] rounded transition-colors ${view === 'diff' ? 'bg-[rgba(255,255,255,0.1)] text-text-primary' : 'text-text-secondary hover:text-white'}`}>Diff</button>
                        <button onClick={() => setView('new')} className={`px-2 py-1 text-[10px] rounded transition-colors ${view === 'new' ? 'bg-[rgba(255,255,255,0.1)] text-text-primary' : 'text-text-secondary hover:text-white'}`}>New</button>
                    </div>
                    <button
                        onClick={handleApply}
                        disabled={applied || isApplying}
                        className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded transition-all ${applied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-accent text-bg-main hover:opacity-90'}`}
                    >
                        {applied ? <Check size={12} /> : <Code2 size={12} />}
                        {applied ? 'Applied' : isApplying ? 'Applying...' : 'Apply to File'}
                    </button>
                </div>
            </div>
            <div className="relative text-[11px] leading-relaxed max-h-96 overflow-y-auto w-full scrollbar-thin scrollbar-thumb-glass-border">
                {view === 'new' ? (
                    <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, background: 'transparent', padding: '1rem' }} PreTag="div">
                        {newContent}
                    </SyntaxHighlighter>
                ) : (
                    <div className="p-4 font-mono whitespace-pre-wrap break-all text-text-secondary leading-relaxed bg-[rgba(0,0,0,0.3)]">
                        {originalContent && <div className="text-red-400/80 mb-2 border-l-2 border-red-500/50 pl-3">
                            {originalContent.split('\n').map((l, i) => <div key={i}>- {l}</div>)}
                        </div>}
                        <div className="text-green-400/80 border-l-2 border-green-500/50 pl-3">
                            {newContent.split('\n').map((l, i) => <div key={i}>+ {l}</div>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
