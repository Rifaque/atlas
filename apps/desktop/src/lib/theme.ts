/** Theme utility — manages dark/light mode preference */

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'atlas-theme';

/** Resolve what the effective theme is (dark or light) */
function resolveTheme(pref: Theme): 'dark' | 'light' {
    if (pref === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref;
}

/** Apply theme and accent to the <html> element */
function applyTheme(theme: 'dark' | 'light', accent?: string) {
    document.documentElement.setAttribute('data-theme', theme);
    if (accent) {
        document.documentElement.style.setProperty('--accent', accent);
        // Simplified auto-generating muted/glow variants for convenience
        // In a real app we might use chroma-js or similar, but for now we'll stick to basic hex support
        document.documentElement.style.setProperty('--accent-muted', `${accent}25`); // 15% opacity hex
        document.documentElement.style.setProperty('--accent-glow', `${accent}40`);  // 25% opacity hex
    }
}

/** Get stored preference */
export function getStoredTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    return 'dark'; // default to dark
}

/** Set and apply theme and accent */
export function setTheme(pref: Theme, accent?: string) {
    localStorage.setItem(STORAGE_KEY, pref);
    if (accent) localStorage.setItem('atlas-accent', accent);
    applyTheme(resolveTheme(pref), accent || localStorage.getItem('atlas-accent') || undefined);
}

export function getStoredAccent(): string {
    return localStorage.getItem('atlas-accent') || '#6366f1'; // Default Indigo
}

/** Initialize theme on app start — call once in App.tsx */
export function initTheme() {
    const pref = getStoredTheme();
    const accent = getStoredAccent();
    applyTheme(resolveTheme(pref), accent);

    // Listen for OS theme changes when set to 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getStoredTheme() === 'system') {
            applyTheme(resolveTheme('system'), getStoredAccent());
        }
    });
}

/** Toggle between dark and light (skips system for simplicity) */
export function toggleTheme(): Theme {
    const current = getStoredTheme();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
}

/** Get the currently active resolved theme */
export function getCurrentTheme(): 'dark' | 'light' {
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
}
