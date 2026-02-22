// watches the file system for changes and triggers re-indexing
import { watch, FSWatcher } from 'chokidar';
import { startIndexing, jobs } from './indexer';

const activeWatchers = new Map<string, FSWatcher>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function stopWatching(folderPath: string) {
    const watcher = activeWatchers.get(folderPath);
    if (watcher) {
        watcher.close();
        activeWatchers.delete(folderPath);
    }
}

export function startWatching(folderPath: string, model: string) {
    if (activeWatchers.has(folderPath)) return; // already watching

    // we ignore hidden dirs/files (.git, .node_modules, etc)
    const watcher = watch(folderPath, {
        ignored: [/(^|[\/\\])\../, /node_modules/, /dist/, /build/],
        persistent: true,
        ignoreInitial: true, // we don't need a storm of events on boot
    });

    const triggerReindex = () => {
        // clear old debounce
        if (debounceTimers.has(folderPath)) {
            clearTimeout(debounceTimers.get(folderPath)!);
        }

        // debounce 3 seconds — we wait for the user to stop saving/typing
        const timer = setTimeout(() => {
            // check if there's already an active indexing job for this folder
            let isRunning = false;
            for (const job of jobs.values()) {
                if (job.folderPath === folderPath && job.status === 'running') {
                    isRunning = true;
                    break;
                }
            }

            if (!isRunning) {
                console.log(`[watcher] Changes detected in ${folderPath}. Triggering incremental index...`);
                startIndexing(folderPath, model).catch(err => {
                    console.error('[watcher] Auto-index failed:', err);
                });
            } else {
                // If currently running, try again in 5 seconds
                console.log(`[watcher] Indexing already running for ${folderPath}. Postponing...`);
                setTimeout(triggerReindex, 5000);
            }
        }, 3000);

        debounceTimers.set(folderPath, timer);
    };

    watcher
        .on('add', triggerReindex)
        .on('change', triggerReindex)
        .on('unlink', triggerReindex);

    activeWatchers.set(folderPath, watcher);
    console.log(`[watcher] Started watching ${folderPath}`);
}
