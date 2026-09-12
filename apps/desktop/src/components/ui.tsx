import {
    forwardRef,
    useEffect,
    useId,
    useRef,
    type ButtonHTMLAttributes,
    type HTMLAttributes,
    type InputHTMLAttributes,
    type ReactNode,
    type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'small' | 'medium';
    loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { className, variant = 'secondary', size = 'medium', loading = false, disabled, children, ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            className={cn('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading && <Loader2 size={14} className="ui-spinner" aria-hidden="true" />}
            {children}
        </button>
    );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { className, label, active, children, ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            className={cn('ui-icon-button', active && 'is-active', className)}
            aria-label={label}
            title={label}
            aria-pressed={active === undefined ? undefined : active}
            {...props}
        >
            {children}
        </button>
    );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
    { className, ...props },
    ref,
) {
    return <input ref={ref} className={cn('ui-input', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
    { className, ...props },
    ref,
) {
    return <textarea ref={ref} className={cn('ui-input ui-textarea', className)} {...props} />;
});

export function Spinner({ label = 'Loading', size = 16 }: { label?: string; size?: number }) {
    return <Loader2 size={size} className="ui-spinner" role="status" aria-label={label} />;
}

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const alertIcons = {
    info: Info,
    success: CheckCircle2,
    warning: TriangleAlert,
    danger: AlertCircle,
};

export function InlineAlert({
    tone = 'info',
    title,
    children,
    actions,
    className,
}: {
    tone?: AlertTone;
    title: string;
    children?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    const Icon = alertIcons[tone];
    return (
        <div className={cn('ui-alert', `ui-alert--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
            <Icon size={16} aria-hidden="true" />
            <div className="ui-alert__body">
                <strong>{title}</strong>
                {children && <div className="ui-alert__copy">{children}</div>}
                {actions && <div className="ui-alert__actions">{actions}</div>}
            </div>
        </div>
    );
}

export function EmptyState({ icon, title, children, action }: {
    icon?: ReactNode;
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="ui-empty">
            {icon && <div className="ui-empty__icon" aria-hidden="true">{icon}</div>}
            <h2>{title}</h2>
            {children && <div className="ui-empty__copy">{children}</div>}
            {action}
        </div>
    );
}

export function Dialog({
    title,
    description,
    children,
    footer,
    onClose,
    className,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    className?: string;
}) {
    const titleId = useId();
    const descriptionId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        openerRef.current = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []);
        focusable()[0]?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
            }
            if (event.key === 'Tab') {
                const items = focusable();
                if (!items.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            openerRef.current?.focus();
        };
    }, []);

    return (
        <div className="ui-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                className={cn('ui-dialog', className)}
            >
                <header className="ui-dialog__header">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        {description && <p id={descriptionId}>{description}</p>}
                    </div>
                    <IconButton label={`Close ${title}`} onClick={onClose}><X size={17} /></IconButton>
                </header>
                <div className="ui-dialog__content">{children}</div>
                {footer && <footer className="ui-dialog__footer">{footer}</footer>}
            </div>
        </div>
    );
}

export function StatusDot({ tone = 'neutral', label }: {
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'active';
    label: string;
}) {
    return (
        <span className="ui-status">
            <span className={`ui-status__dot ui-status__dot--${tone}`} aria-hidden="true" />
            <span>{label}</span>
        </span>
    );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
    return <span className="sr-only">{children}</span>;
}

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('ui-surface', className)} {...props} />;
}
