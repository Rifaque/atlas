import { useState, useEffect } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { UpdateChecker } from './components/UpdateChecker';
import { ToastProvider } from './lib/toast';
import { getActiveWorkspace, type Workspace } from './lib/workspaces';
import { initTheme } from './lib/theme';

// Initialize theme before first paint
initTheme();

// loading screen when you first open the app
function StartupSplash() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-main" role="main" aria-label="Atlas is starting">
      <div className="text-center space-y-3 animate-in fade-in duration-700">
        <div className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-text-primary to-text-secondary bg-clip-text text-transparent">
          Atlas
        </div>
        <div className="flex items-center gap-2 justify-center text-text-secondary text-sm" aria-live="polite">
          <div className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" role="progressbar" aria-label="Starting" />
          Starting…
        </div>
      </div>
    </div>
  );
}

// Main app component
function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [checked, setChecked] = useState(false);

  // Restore last workspace on mount
  useEffect(() => {
    const ws = getActiveWorkspace();
    if (ws) setActiveWorkspace(ws);
    setChecked(true);
  }, []);

  if (!checked) return <StartupSplash />;

  return (
    <ToastProvider>
      {activeWorkspace
        ? <WorkspaceLayout
          workspace={activeWorkspace}
          onLeaveWorkspace={() => setActiveWorkspace(null)}
        />
        : <LandingScreen onIndexed={(ws) => setActiveWorkspace(ws)} />
      }
      <UpdateChecker />
    </ToastProvider>
  );
}

export default App;
