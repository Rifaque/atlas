import { useState, useEffect } from 'react';
import { LandingScreen } from './components/LandingScreen';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { ToastProvider } from './components/ToastProvider';
import { getActiveWorkspace, setActiveWorkspace as persistActiveWorkspace, type Workspace } from './lib/workspaces';
import { initTheme } from './lib/theme';
import { isWorkspaceAuthorized } from './lib/api';
import { migrateLegacyCredentials } from './lib/settings';

// Initialize theme before first paint
initTheme();

// loading screen when you first open the app
function StartupSplash() {
  return (
    <div className="startup" role="main" aria-label="Atlas is starting">
      <img className="startup__mark" src="/atlas-mark.svg" alt="" />
      <div>
        <strong>Atlas</strong>
        <div className="startup__status" aria-live="polite">
          <span className="startup__spinner" role="progressbar" aria-label="Starting" />
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

  // Restore last workspaces on mount
  useEffect(() => {
    const restoreWorkspace = async () => {
      try {
        await migrateLegacyCredentials();
      } catch (error) {
        console.warn('Legacy credentials could not be migrated; re-enter them in Settings.', error);
      }
      const workspace = getActiveWorkspace();
      const authorized = workspace
        ? await isWorkspaceAuthorized(workspace.folderPath).catch(() => false)
        : false;
      setActiveWorkspace(authorized ? workspace : null);
      setChecked(true);
    };
    restoreWorkspace();
  }, []);

  if (!checked) return <StartupSplash />;

  return (
    <ToastProvider>
      <div key={activeWorkspace ? 'workspace' : 'landing'} className="app-view">
        {activeWorkspace
          ? <WorkspaceLayout
            workspace={activeWorkspace}
            onLeaveWorkspace={() => {
              persistActiveWorkspace(null);
              setActiveWorkspace(null);
            }}
          />
          : <LandingScreen onIndexed={(workspace) => setActiveWorkspace(workspace)} />
        }
      </div>
    </ToastProvider>
  );
}

export default App;
