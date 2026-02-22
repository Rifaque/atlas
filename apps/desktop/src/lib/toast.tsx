import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toasts: [], showToast: () => { } });

export function useToast() {
    return useContext(ToastContext);
}

let globalToastFn: ((msg: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'info') {
    globalToastFn?.(message, type);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3500);
    }, []);

    // Register global fn
    useEffect(() => {
        globalToastFn = showToast;
        return () => { globalToastFn = null; };
    }, [showToast]);

    const ICONS: Record<ToastType, React.ReactNode> = {
        success: <CheckCircle size={15} className="text-green-400 shrink-0" />,
        error: <AlertCircle size={15} className="text-red-400 shrink-0" />,
        info: <Info size={15} className="text-accent shrink-0" />,
    };

    const BORDERS: Record<ToastType, string> = {
        success: 'border-green-500/30',
        error: 'border-red-500/30',
        info: 'border-accent/30',
    };

    return (
        <ToastContext.Provider value={{ toasts, showToast }}>
            {children}
            {/* Toast Viewport */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0f1520]/95 border ${BORDERS[t.type]} backdrop-blur-md shadow-2xl text-text-primary text-sm font-medium animate-in slide-in-from-right-4 fade-in duration-300 pointer-events-auto`}
                    >
                        {ICONS[t.type]}
                        <span className="flex-1">{t.message}</span>
                        <button
                            onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
                            className="opacity-40 hover:opacity-100 transition-opacity ml-1"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
