import { useState, useEffect, useCallback } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { ToastProvider } from './lib/toast';
import { getActiveWorkspace, type Workspace } from './lib/workspaces';
import { loadSettings } from './components/SettingsModal';
import { SetupModal, useSetupModal } from './components/SetupModal';
import { RefreshCw, ServerCrash } from 'lucide-react';

// ─── Backend health banner ─────────────────────────────────────────────────────
type BackendStatus = 'checking' | 'online' | 'offline';

function BackendOfflineBanner({ backendUrl, onRetry }: { backendUrl: string; onRetry: () => void }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-sm shadow-lg text-sm text-amber-300 max-w-md"
    >
      <ServerCrash size={16} className="shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">Backend not reachable.</span>{' '}
        <span className="opacity-80 text-xs">Trying <code className="font-mono bg-white/10 px-1 rounded">{backendUrl}</code></span>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 flex items-center gap-1 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label="Retry connecting to backend"
      >
        <RefreshCw size={11} aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

// ─── Splash / startup loading screen ──────────────────────────────────────────
function StartupSplash({ status }: { status: BackendStatus }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-main" role="main" aria-label="Atlas is starting">
      <div className="text-center space-y-3 animate-in fade-in duration-700">
        <div className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-text-primary to-text-secondary bg-clip-text text-transparent">
          Atlas
        </div>
        {status === 'checking' && (
          <div className="flex items-center gap-2 justify-center text-text-secondary text-sm" aria-live="polite">
            <div className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" role="progressbar" aria-label="Checking services" />
            Starting services…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [checked, setChecked] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:47291');
  const { show: showSetup, dismiss: dismissSetup } = useSetupModal(backendStatus === 'online');

  const checkBackend = useCallback(async (url?: string) => {
    const target = url ?? backendUrl;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000); // 3s timeout
      const r = await fetch(`${target}/ping`, { signal: ctrl.signal });
      clearTimeout(timer);
      setBackendStatus(r.ok ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  }, [backendUrl]);

  // Restore last workspace and read backend URL from settings, then check health
  useEffect(() => {
    const settings = loadSettings();
    const url = settings.backendUrl ?? 'http://127.0.0.1:47291';
    setBackendUrl(url);

    const ws = getActiveWorkspace();
    if (ws) setActiveWorkspace(ws);
    setChecked(true);

    // Health check with auto-retry — the Tauri sidecar may need a few seconds to start
    let retries = 0;
    const MAX_RETRIES = 8;
    const RETRY_DELAY_MS = 1500;

    const tryBackend = async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const r = await fetch(`${url}/ping`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (r.ok) { setBackendStatus('online'); return; }
      } catch { /* continue */ }

      retries++;
      if (retries < MAX_RETRIES) {
        setTimeout(tryBackend, RETRY_DELAY_MS * Math.min(retries, 3)); // exponential cap
      } else {
        setBackendStatus('offline');
      }
    };

    tryBackend();
  }, []);

  // Poll every 30s to detect if backend goes away mid-session
  useEffect(() => {
    if (backendStatus === 'checking') return;
    const id = setInterval(() => checkBackend(), 30_000);
    return () => clearInterval(id);
  }, [backendStatus, checkBackend]);

  // Wait for the initial workspace-check before rendering
  if (!checked) return <StartupSplash status={backendStatus} />;

  return (
    <ToastProvider>
      {/* Setup modal — shown when Ollama/ChromaDB/models are missing */}
      {showSetup && <SetupModal onDismiss={dismissSetup} />}

      {/* Offline banner — shown on top of everything when backend is unreachable */}
      {backendStatus === 'offline' && (
        <BackendOfflineBanner
          backendUrl={backendUrl}
          onRetry={() => {
            setBackendStatus('checking');
            checkBackend();
          }}
        />
      )}

      {activeWorkspace
        ? <WorkspaceLayout
          workspace={activeWorkspace}
          onLeaveWorkspace={() => setActiveWorkspace(null)}
        />
        : <LandingScreen onIndexed={(ws) => setActiveWorkspace(ws)} />
      }
    </ToastProvider>
  );
}

export default App;
