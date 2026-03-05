import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type UpdateState =
    | { status: 'idle' }
    | { status: 'available'; version: string; notes: string }
    | { status: 'downloading'; progress: number }
    | { status: 'ready' }
    | { status: 'error'; message: string };

/**
 * UpdateChecker — Checks for updates on mount and shows a non-intrusive
 * banner when a new version is available. Uses the Tauri updater plugin.
 */
export function UpdateChecker() {
    const [state, setState] = useState<UpdateState>({ status: 'idle' });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const run = async () => {
            try {
                const update = await check();
                if (update) {
                    setState({
                        status: 'available',
                        version: update.version,
                        notes: update.body || '',
                    });
                }
            } catch (e: any) {
                // Silently ignore update check failures (offline, no key, etc.)
                console.warn('[updater] Check failed:', e?.message || e);
            }
        };

        // Delay check by 5 seconds to avoid slowing startup
        const timer = setTimeout(run, 5000);
        return () => clearTimeout(timer);
    }, []);

    const handleDownload = async () => {
        setState({ status: 'downloading', progress: 0 });
        try {
            const update = await check();
            if (!update) return;

            let downloaded = 0;
            let contentLength = 0;

            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength || 0;
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        if (contentLength > 0) {
                            setState({
                                status: 'downloading',
                                progress: Math.round((downloaded / contentLength) * 100),
                            });
                        }
                        break;
                    case 'Finished':
                        setState({ status: 'ready' });
                        break;
                }
            });

            setState({ status: 'ready' });
        } catch (e: any) {
            setState({ status: 'error', message: e?.message || 'Download failed' });
        }
    };

    const handleRelaunch = async () => {
        await relaunch();
    };

    // Don't show anything if idle, dismissed, or no update
    if (state.status === 'idle' || dismissed) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#0f1520] border border-glass-border rounded-xl shadow-2xl p-4 w-80 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                        {state.status === 'error' ? (
                            <AlertTriangle size={14} className="text-red-400" />
                        ) : state.status === 'ready' ? (
                            <CheckCircle2 size={14} className="text-green-400" />
                        ) : (
                            <Download size={14} className="text-accent" />
                        )}
                        {state.status === 'available' && `Update v${state.version}`}
                        {state.status === 'downloading' && 'Downloading…'}
                        {state.status === 'ready' && 'Update Ready'}
                        {state.status === 'error' && 'Update Failed'}
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 text-text-secondary hover:text-white transition-colors"
                        title="Dismiss"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* Available state */}
                {state.status === 'available' && (
                    <>
                        {state.notes && (
                            <p className="text-[11px] text-text-secondary line-clamp-3">
                                {state.notes}
                            </p>
                        )}
                        <button
                            onClick={handleDownload}
                            className="w-full py-2 text-xs font-medium rounded-lg bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Download size={12} />
                            Download & Install
                        </button>
                    </>
                )}

                {/* Downloading state */}
                {state.status === 'downloading' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <Loader2 size={12} className="animate-spin text-accent" />
                            {state.progress}%
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-glass-border overflow-hidden">
                            <div
                                className="h-full bg-accent rounded-full transition-all duration-300"
                                style={{ width: `${state.progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Ready state */}
                {state.status === 'ready' && (
                    <button
                        onClick={handleRelaunch}
                        className="w-full py-2 text-xs font-medium rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                        Restart Now
                    </button>
                )}

                {/* Error state */}
                {state.status === 'error' && (
                    <p className="text-[11px] text-red-400/80">{state.message}</p>
                )}
            </div>
        </div>
    );
}
