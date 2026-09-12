import { invoke } from '@tauri-apps/api/core';

export const SETTINGS_SCHEMA_VERSION = 3;
export const CLOUD_DISCLOSURE_VERSION = 1;
export type GenerationProvider = 'ollama' | 'openrouter';

export interface AtlasSettings {
    version: typeof SETTINGS_SCHEMA_VERSION;
    generationProvider: GenerationProvider;
    generationModel: string;
    ollamaHost: string;
    systemPrompt: string;
    includeGitContext: boolean;
    cloudConsentVersion: number;
    theme: 'dark' | 'light' | 'system';
    /** Transient input only; never persisted or returned after save. */
    openRouterApiKey: string;
}

interface WorkspaceGenerationSettings {
    generationProvider: GenerationProvider;
    generationModel: string;
    systemPrompt: string;
    includeGitContext: boolean;
    cloudConsentVersion: number;
}

interface SettingsEnvelope {
    version: typeof SETTINGS_SCHEMA_VERSION;
    general: Pick<AtlasSettings, 'ollamaHost' | 'theme'>;
    defaults: WorkspaceGenerationSettings;
    workspaces: Record<string, WorkspaceGenerationSettings>;
}

export const DEFAULT_SETTINGS: AtlasSettings = {
    version: SETTINGS_SCHEMA_VERSION,
    generationProvider: 'ollama',
    generationModel: 'llama3.2:latest',
    ollamaHost: 'http://127.0.0.1:11434',
    systemPrompt: '',
    includeGitContext: true,
    cloudConsentVersion: 0,
    theme: 'dark',
    openRouterApiKey: '',
};

const KEY = 'atlas_settings_v3';
const PREVIOUS_KEY = 'atlas_settings_v2';
const LEGACY_KEY = 'atlas_settings';

function validGeneration(value: unknown): WorkspaceGenerationSettings | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.generationProvider !== 'ollama' && candidate.generationProvider !== 'openrouter') return null;
    return {
        generationProvider: candidate.generationProvider,
        generationModel: typeof candidate.generationModel === 'string' ? candidate.generationModel : DEFAULT_SETTINGS.generationModel,
        systemPrompt: typeof candidate.systemPrompt === 'string' ? candidate.systemPrompt : '',
        includeGitContext: typeof candidate.includeGitContext === 'boolean' ? candidate.includeGitContext : true,
        cloudConsentVersion: typeof candidate.cloudConsentVersion === 'number' ? candidate.cloudConsentVersion : 0,
    };
}

function defaultEnvelope(): SettingsEnvelope {
    return {
        version: SETTINGS_SCHEMA_VERSION,
        general: { ollamaHost: DEFAULT_SETTINGS.ollamaHost, theme: DEFAULT_SETTINGS.theme },
        defaults: {
            generationProvider: DEFAULT_SETTINGS.generationProvider,
            generationModel: DEFAULT_SETTINGS.generationModel,
            systemPrompt: '',
            includeGitContext: true,
            cloudConsentVersion: 0,
        },
        workspaces: {},
    };
}

function loadEnvelope(): SettingsEnvelope {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
        if (parsed?.version === SETTINGS_SCHEMA_VERSION) {
            const general = parsed.general as Record<string, unknown> | undefined;
            const defaults = validGeneration(parsed.defaults);
            if (general && defaults && parsed.workspaces && typeof parsed.workspaces === 'object') {
                const envelope = defaultEnvelope();
                envelope.general = {
                    ollamaHost: typeof general.ollamaHost === 'string' ? general.ollamaHost : DEFAULT_SETTINGS.ollamaHost,
                    theme: general.theme === 'light' || general.theme === 'system' ? general.theme : 'dark',
                };
                envelope.defaults = defaults;
                for (const [workspaceId, value] of Object.entries(parsed.workspaces as Record<string, unknown>)) {
                    const settings = validGeneration(value);
                    if (settings) envelope.workspaces[workspaceId] = settings;
                }
                return envelope;
            }

            // Migrate the short-lived flat Phase 2 shape without losing settings.
            const flat = validGeneration(parsed);
            if (flat) {
                const envelope = defaultEnvelope();
                envelope.defaults = flat;
                envelope.general.ollamaHost = typeof parsed.ollamaHost === 'string' ? parsed.ollamaHost : DEFAULT_SETTINGS.ollamaHost;
                envelope.general.theme = parsed.theme === 'light' || parsed.theme === 'system' ? parsed.theme : 'dark';
                localStorage.setItem(KEY, JSON.stringify(envelope));
                return envelope;
            }
        }
    } catch {
        // Preserve malformed current storage and attempt the supported legacy migration.
    }

    const envelope = defaultEnvelope();
    try {
        const previous = JSON.parse(localStorage.getItem(PREVIOUS_KEY) ?? 'null') as Record<string, unknown> | null;
        if (previous?.version === 2 && previous.general && previous.defaults && previous.workspaces) {
            const general = previous.general as Record<string, unknown>;
            const defaults = validGeneration(previous.defaults);
            if (defaults) {
                envelope.general = {
                    ollamaHost: typeof general.ollamaHost === 'string' ? general.ollamaHost : DEFAULT_SETTINGS.ollamaHost,
                    theme: general.theme === 'light' || general.theme === 'system' ? general.theme : 'dark',
                };
                envelope.defaults = defaults;
                for (const [workspaceId, value] of Object.entries(previous.workspaces as Record<string, unknown>)) {
                    const generation = validGeneration(value);
                    if (generation) envelope.workspaces[workspaceId] = generation;
                }
                localStorage.setItem(KEY, JSON.stringify(envelope));
                return envelope;
            }
        }
    } catch {
        // Preserve malformed previous state and continue to the older migration.
    }
    try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as Record<string, unknown> | null;
        if (legacy) {
            envelope.defaults = {
                generationProvider: legacy.provider === 'openrouter' ? 'openrouter' : 'ollama',
                generationModel: typeof legacy.model === 'string' ? legacy.model : DEFAULT_SETTINGS.generationModel,
                systemPrompt: typeof legacy.systemPrompt === 'string' ? legacy.systemPrompt : '',
                includeGitContext: true,
                cloudConsentVersion: 0,
            };
            envelope.general.ollamaHost = typeof legacy.ollamaHost === 'string' ? legacy.ollamaHost : DEFAULT_SETTINGS.ollamaHost;
            envelope.general.theme = legacy.theme === 'light' || legacy.theme === 'system' ? legacy.theme : 'dark';
            localStorage.setItem(KEY, JSON.stringify(envelope));
        }
    } catch {
        // Malformed state remains under its old key and safe defaults are used.
    }
    return envelope;
}

export function loadSettings(workspaceId?: string): AtlasSettings {
    const envelope = loadEnvelope();
    const generation = workspaceId ? envelope.workspaces[workspaceId] ?? envelope.defaults : envelope.defaults;
    return { ...DEFAULT_SETTINGS, ...envelope.general, ...generation, openRouterApiKey: '' };
}

export function persistSettings(settings: AtlasSettings, workspaceId?: string): void {
    const envelope = loadEnvelope();
    envelope.general = { ollamaHost: settings.ollamaHost, theme: settings.theme };
    const generation: WorkspaceGenerationSettings = {
        generationProvider: settings.generationProvider,
        generationModel: settings.generationModel,
        systemPrompt: settings.systemPrompt,
        includeGitContext: settings.includeGitContext,
        cloudConsentVersion: settings.cloudConsentVersion,
    };
    if (workspaceId) envelope.workspaces[workspaceId] = generation;
    else envelope.defaults = generation;
    localStorage.setItem(KEY, JSON.stringify(envelope));
}

export async function storeOpenRouterCredential(value: string): Promise<void> {
    await invoke('store_credential', { name: 'openrouter', value });
}

export async function hasOpenRouterCredential(): Promise<boolean> {
    return invoke<boolean>('has_credential', { name: 'openrouter' });
}

export async function removeOpenRouterCredential(): Promise<void> {
    await invoke('remove_credential', { name: 'openrouter' });
}

/** Migrate only the retained OpenRouter secret. Obsolete keys remain recoverable in legacy storage. */
export async function migrateLegacyCredentials(): Promise<void> {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as Record<string, unknown>;
    if (typeof legacy.openRouterApiKey !== 'string' || !legacy.openRouterApiKey.trim()) return;
    await storeOpenRouterCredential(legacy.openRouterApiKey);
    delete legacy.openRouterApiKey;
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
}
