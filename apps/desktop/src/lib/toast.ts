export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

type ToastHandler = (message: string, type?: ToastType) => void;

let globalToastHandler: ToastHandler | null = null;

export function registerToastHandler(handler: ToastHandler | null) {
    globalToastHandler = handler;
}

export function toast(message: string, type: ToastType = 'info') {
    globalToastHandler?.(message, type);
}
