import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, persistSettings } from './settings';

describe('settings persistence', () => {
    const values = new Map<string, string>();

    beforeEach(() => {
        values.clear();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        });
    });

    it('never writes provider secrets to localStorage', () => {
        persistSettings({
            ...DEFAULT_SETTINGS,
            openRouterApiKey: 'sk-or-v1-secret-value-that-must-not-persist',
        });
        const stored = values.get('atlas_settings_v3') ?? '';
        expect(stored).not.toContain('sk-or-v1');
        expect(JSON.parse(stored)).not.toHaveProperty('openRouterApiKey');
    });

    it('migrates only retained model settings and drops obsolete behavior fields', () => {
        values.set('atlas_settings', JSON.stringify({
            provider: 'openrouter', model: 'cloud/model', ollamaHost: 'http://host:11434',
            contextSlots: 99, webSearchEnabled: true, accentColor: '#ff0000', backendUrl: 'unsafe',
        }));
        const settings = loadSettings();
        expect(settings.generationProvider).toBe('openrouter');
        expect(settings.generationModel).toBe('cloud/model');
        expect(settings).not.toHaveProperty('contextSlots');
        expect(settings).not.toHaveProperty('webSearchEnabled');
        expect(settings).not.toHaveProperty('accentColor');
        expect(settings).not.toHaveProperty('backendUrl');
    });

    it('keeps generation provider and model scoped to a workspace', () => {
        persistSettings({
            ...DEFAULT_SETTINGS,
            generationProvider: 'openrouter',
            generationModel: 'cloud/model',
        }, 'C:/workspace-a');

        expect(loadSettings('C:/workspace-a').generationProvider).toBe('openrouter');
        expect(loadSettings('C:/workspace-a').generationModel).toBe('cloud/model');
        expect(loadSettings('C:/workspace-b').generationProvider).toBe('ollama');
        expect(loadSettings('C:/workspace-b').generationModel).toBe(DEFAULT_SETTINGS.generationModel);
    });

    it('migrates Phase 2 settings without silently granting cloud authorization', () => {
        values.set('atlas_settings_v2', JSON.stringify({
            version: 2,
            general: { ollamaHost: 'http://localhost:11434', theme: 'light' },
            defaults: { generationProvider: 'ollama', generationModel: 'local/model', systemPrompt: '' },
            workspaces: {
                'C:/workspace-a': { generationProvider: 'openrouter', generationModel: 'cloud/model', systemPrompt: 'ground answers' },
            },
        }));
        const settings = loadSettings('C:/workspace-a');
        expect(settings.generationProvider).toBe('openrouter');
        expect(settings.generationModel).toBe('cloud/model');
        expect(settings.cloudConsentVersion).toBe(0);
        expect(settings.includeGitContext).toBe(true);
    });

    it('keeps cloud consent and Git context scoped to their workspace', () => {
        persistSettings({ ...DEFAULT_SETTINGS, generationProvider: 'openrouter', cloudConsentVersion: 1, includeGitContext: false }, 'C:/workspace-a');
        expect(loadSettings('C:/workspace-a').cloudConsentVersion).toBe(1);
        expect(loadSettings('C:/workspace-a').includeGitContext).toBe(false);
        expect(loadSettings('C:/workspace-b').cloudConsentVersion).toBe(0);
        expect(loadSettings('C:/workspace-b').includeGitContext).toBe(true);
    });
});
