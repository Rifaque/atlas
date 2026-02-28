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

/** Apply theme to the <html> element */
function applyTheme(theme: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', theme);
}

/** Get stored preference */
export function getStoredTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    return 'dark'; // default to dark
}

/** Set and apply theme */
export function setTheme(pref: Theme) {
    localStorage.setItem(STORAGE_KEY, pref);
    applyTheme(resolveTheme(pref));
}

/** Initialize theme on app start — call once in App.tsx */
export function initTheme() {
    const pref = getStoredTheme();
    applyTheme(resolveTheme(pref));

    // Listen for OS theme changes when set to 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getStoredTheme() === 'system') {
            applyTheme(resolveTheme('system'));
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
