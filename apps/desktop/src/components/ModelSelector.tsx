import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Server, Cloud, Star } from 'lucide-react';

export interface ModelSelectorProps {
    value: string;
    onChange: (model: string) => void;
    availableModels: { local: string[]; orFree: string[]; orPaid: string[] };
    defaultModel: string;
    provider: string;
}

export function ModelSelector({ value, onChange, availableModels, defaultModel, provider }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const displayValue = value || defaultModel;
    const shortDisplay = displayValue.split('/').pop() || displayValue;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 bg-bg-surface border border-glass-border hover:border-accent/40 text-text-secondary hover:text-white px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-all shadow-sm group"
                title="Select Model"
            >
                <span className="truncate max-w-[120px]">{shortDisplay}</span>
                <ChevronDown size={12} className={`opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-64 bg-bg-surface border border-glass-border shadow-2xl rounded-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 transform origin-bottom-right">
                    <div className="max-h-[300px] overflow-y-auto w-full p-2 space-y-1 custom-scrollbar">

                        {/* Default Model */}
                        <div className="mb-2">
                            <button
                                onClick={() => { onChange(''); setIsOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${value === '' ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-bg-surface-hover hover:text-white'}`}
                            >
                                <span className="truncate">Default ({defaultModel.split('/').pop()})</span>
                                {value === '' && <Check size={14} />}
                            </button>
                        </div>

                        {/* Local Models */}
                        {provider === 'ollama' && availableModels.local.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                                    <Server size={10} /> Local (Ollama)
                                </div>
                                {availableModels.local.filter(m => m !== defaultModel).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => { onChange(m); setIsOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${value === m ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-bg-surface-hover hover:text-white'}`}
                                    >
                                        <span className="truncate">{m}</span>
                                        {value === m && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* OpenRouter Models */}
                        {provider === 'openrouter' && (
                            <>
                                {availableModels.orFree.length > 0 && (
                                    <div className="mb-2">
                                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                                            <Cloud size={10} /> OpenRouter (Free)
                                        </div>
                                        {availableModels.orFree.filter(m => m !== defaultModel).map(m => (
                                            <button
                                                key={m}
                                                onClick={() => { onChange(m); setIsOpen(false); }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${value === m ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-bg-surface-hover hover:text-white'}`}
                                            >
                                                <span className="truncate" title={m}>{m.split('/').pop()}</span>
                                                {value === m && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {availableModels.orPaid.length > 0 && (
                                    <div>
                                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                                            <Star size={10} /> OpenRouter (Paid)
                                        </div>
                                        {availableModels.orPaid.filter(m => m !== defaultModel).map(m => (
                                            <button
                                                key={m}
                                                onClick={() => { onChange(m); setIsOpen(false); }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${value === m ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-bg-surface-hover hover:text-white'}`}
                                            >
                                                <span className="truncate" title={m}>{m.split('/').pop()}</span>
                                                {value === m && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
