import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, active, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-[8px] bg-glass-bg border border-glass-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-[rgba(255,255,255,0.05)] focus:outline-none focus:ring-1 focus:ring-accent",
                    active && "border-accent",
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';
