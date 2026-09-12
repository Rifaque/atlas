import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { registerToastHandler, type ToastMessage, type ToastType } from '../lib/toast';

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = crypto.randomUUID();
        setToasts((previousToasts) => [...previousToasts, { id, type, message }]);
        setTimeout(() => {
            setToasts((previousToasts) => previousToasts.filter((toast) => toast.id !== id));
        }, 3500);
    }, []);

    useEffect(() => {
        registerToastHandler(showToast);
        return () => registerToastHandler(null);
    }, [showToast]);

    const icons: Record<ToastType, React.ReactNode> = {
        success: <CheckCircle size={15} className="text-green-400 shrink-0" />,
        error: <AlertCircle size={15} className="text-red-400 shrink-0" />,
        info: <Info size={15} className="text-accent shrink-0" />,
    };

    const borders: Record<ToastType, string> = {
        success: 'border-green-500/30',
        error: 'border-red-500/30',
        info: 'border-accent/30',
    };

    return (
        <>
            {children}
            <div className="toast-region" aria-label="Notifications">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`toast-message ${borders[toast.type]}`}
                    >
                        {icons[toast.type]}
                        <span className="flex-1">{toast.message}</span>
                        <button
                            onClick={() => setToasts((previousToasts) => previousToasts.filter((item) => item.id !== toast.id))}
                            className="toast-message__close"
                            aria-label="Dismiss notification"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}
