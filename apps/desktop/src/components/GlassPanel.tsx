import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
    subtle?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
    ({ className, subtle, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-[8px] border border-glass-border backdrop-blur-[10px]",
                    subtle ? "bg-[rgba(20,25,35,0.12)]" : "bg-glass-bg",
                    className
                )}
                {...props}
            />
        );
    }
);

GlassPanel.displayName = 'GlassPanel';
