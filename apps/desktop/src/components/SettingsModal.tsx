import { useMemo, useState } from 'react';
import { Database, Info, LockKeyhole, RefreshCw, Server, SlidersHorizontal } from 'lucide-react';
import { checkOllamaStatus, type IndexHealth } from '../lib/api';
import { CLOUD_DISCLOSURE_VERSION, type AtlasSettings, type GenerationProvider } from '../lib/settings';
import { Button, Dialog, InlineAlert, Input, StatusDot, Textarea } from './ui';

interface SettingsModalProps {
    settings: AtlasSettings;
    embeddingModel: string;
    indexHealth: IndexHealth | null;
    credentialExists: boolean;
    onSave: (settings: AtlasSettings) => void | Promise<void>;
    onRemoveCredential: () => void | Promise<void>;
    onReindex: () => void;
    onClose: () => void;
}

type Tab = 'general' | 'models' | 'indexing' | 'advanced';

const sections: Array<{ id: Tab; label: string; icon: typeof SlidersHorizontal }> = [
    { id: 'general', label: 'General', icon: SlidersHorizontal },
    { id: 'models', label: 'Models & Privacy', icon: LockKeyhole },
    { id: 'indexing', label: 'Indexing', icon: Database },
    { id: 'advanced', label: 'Advanced', icon: Server },
];

function validHost(value: string) {
    try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
}

export function SettingsModal({ settings, embeddingModel, indexHealth, credentialExists, onSave, onRemoveCredential, onReindex, onClose }: SettingsModalProps) {
    const [tab, setTab] = useState<Tab>('general');
    const [draft, setDraft] = useState(settings);
    const [connection, setConnection] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
    const [saving, setSaving] = useState(false);
    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
    const hostValid = validHost(draft.ollamaHost);
    const modelValid = Boolean(draft.generationModel.trim());
    const cloudAuthorized = draft.cloudConsentVersion >= CLOUD_DISCLOSURE_VERSION;
    const cloudCredentialReady = credentialExists || Boolean(draft.openRouterApiKey.trim());
    const canSave = hostValid && modelValid && (draft.generationProvider !== 'openrouter' || (cloudAuthorized && cloudCredentialReady)) && !saving;
    const set = <K extends keyof AtlasSettings>(key: K, value: AtlasSettings[K]) => setDraft(current => ({ ...current, [key]: value }));
    const requestClose = () => {
        if (!dirty || window.confirm('Discard unsaved settings changes?')) onClose();
    };

    return (
        <Dialog title="Settings" description="Configuration for this workspace and Atlas on this device." onClose={requestClose} className="settings-dialog" footer={(
            <>
                <span className="settings-dirty" aria-live="polite">{dirty ? 'Unsaved changes' : 'No pending changes'}</span>
                <Button onClick={requestClose}>Cancel</Button>
                <Button variant="primary" disabled={!canSave} loading={saving} onClick={async () => { setSaving(true); try { await onSave(draft); onClose(); } finally { setSaving(false); } }}>Save changes</Button>
            </>
        )}>
            <div className="settings-layout">
                <nav className="settings-nav" aria-label="Settings sections">
                    {sections.map(section => {
                        const Icon = section.icon;
                        return <button key={section.id} aria-current={tab === section.id ? 'page' : undefined} onClick={() => setTab(section.id)}><Icon size={15} />{section.label}</button>;
                    })}
                </nav>
                <div className="settings-content">
                    {tab === 'general' && (
                        <section aria-labelledby="settings-general">
                            <h3 id="settings-general">General</h3>
                            <p className="settings-lead">Choose how Atlas follows your desktop appearance.</p>
                            <div className="settings-field">
                                <label htmlFor="theme">Theme</label>
                                <select id="theme" className="ui-input" value={draft.theme} onChange={event => set('theme', event.target.value as AtlasSettings['theme'])}>
                                    <option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option>
                                </select>
                            </div>
                        </section>
                    )}

                    {tab === 'models' && (
                        <section aria-labelledby="settings-models">
                            <h3 id="settings-models">Models & Privacy</h3>
                            <p className="settings-lead">Embedding stays separate from the model that writes answers.</p>
                            <div className="settings-field">
                                <label htmlFor="ollama-host">Ollama host</label>
                                <div className="settings-inline"><Input id="ollama-host" value={draft.ollamaHost} onChange={event => { set('ollamaHost', event.target.value); setConnection('idle'); }} aria-invalid={!hostValid} /><Button size="small" loading={connection === 'checking'} disabled={!hostValid} onClick={async () => { setConnection('checking'); setConnection(await checkOllamaStatus(draft.ollamaHost) === 'online' ? 'online' : 'offline'); }}>Test connection</Button></div>
                                {!hostValid && <p className="field-error">Enter an HTTP or HTTPS URL.</p>}
                                {connection === 'online' && <StatusDot tone="success" label="Ollama responded" />}
                                {connection === 'offline' && <StatusDot tone="danger" label="Ollama did not respond" />}
                                <p className="field-help">A remote Ollama host is not an on-device privacy boundary.</p>
                            </div>
                            <div className="settings-field">
                                <label htmlFor="generation-provider">Generation provider</label>
                                <select id="generation-provider" className="ui-input" value={draft.generationProvider} onChange={event => set('generationProvider', event.target.value as GenerationProvider)}>
                                    <option value="ollama">Local · Ollama</option><option value="openrouter">Cloud · OpenRouter</option>
                                </select>
                            </div>
                            <div className="settings-field">
                                <label htmlFor="generation-model">Generation model</label>
                                <Input id="generation-model" className="mono" value={draft.generationModel} onChange={event => set('generationModel', event.target.value)} aria-invalid={!modelValid} />
                                {!modelValid && <p className="field-error">Enter a generation model.</p>}
                            </div>
                            <div className="settings-field settings-check">
                                <input id="git-context" type="checkbox" checked={draft.includeGitContext} onChange={event => set('includeGitContext', event.target.checked)} />
                                <label htmlFor="git-context">Include Git context in Ask <span>Branch, changed files, recent commits, and diff summary may influence an answer.</span></label>
                            </div>
                            {draft.generationProvider === 'openrouter' && (
                                <div className="cloud-disclosure">
                                    <InlineAlert tone="warning" title="OpenRouter sends the complete request to the cloud">
                                        The request can include your question, retrieved workspace excerpts, pinned files, relevant conversation history, system instructions, and Git context when enabled. Atlas inspects the complete outbound payload locally and blocks detected secrets before transmission. Local Ollama avoids this cloud transfer.
                                    </InlineAlert>
                                    <div className="settings-field">
                                        <label htmlFor="openrouter-key">OpenRouter credential</label>
                                        <StatusDot tone={credentialExists ? 'success' : 'warning'} label={credentialExists ? 'Credential stored by Atlas' : 'No credential stored'} />
                                        <Input id="openrouter-key" type="password" autoComplete="off" value={draft.openRouterApiKey} onChange={event => set('openRouterApiKey', event.target.value)} placeholder={credentialExists ? 'Enter a new key to replace it' : 'Enter an API key'} />
                                        {credentialExists && <Button size="small" variant="danger" onClick={onRemoveCredential}>Remove stored credential</Button>}
                                    </div>
                                    <div className="settings-check">
                                        <input id="cloud-consent" type="checkbox" checked={cloudAuthorized} onChange={event => set('cloudConsentVersion', event.target.checked ? CLOUD_DISCLOSURE_VERSION : 0)} />
                                        <label htmlFor="cloud-consent">Enable OpenRouter for this workspace <span>I understand which context may leave this device.</span></label>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {tab === 'indexing' && (
                        <section aria-labelledby="settings-indexing">
                            <h3 id="settings-indexing">Indexing</h3>
                            <p className="settings-lead">Factual state for this workspace index.</p>
                            <dl className="index-facts">
                                <div><dt>Status</dt><dd>{indexHealth?.status.replace('_', ' ') ?? 'not indexed'}</dd></div>
                                <div><dt>Embedding model</dt><dd className="mono">{indexHealth?.embeddingModel ?? (embeddingModel || 'Not configured')}</dd></div>
                                <div><dt>Files</dt><dd>{indexHealth?.fileCount ?? 0}</dd></div>
                                <div><dt>Chunks</dt><dd>{indexHealth?.chunkCount ?? 0}</dd></div>
                                <div><dt>Last completed</dt><dd>{indexHealth?.lastCompletedAt ? new Date(indexHealth.lastCompletedAt).toLocaleString() : 'Never'}</dd></div>
                            </dl>
                            {indexHealth?.error && <InlineAlert tone="danger" title="Index failed">{indexHealth.error}</InlineAlert>}
                            <Button onClick={onReindex} disabled={!embeddingModel}><RefreshCw size={14} /> Refresh index</Button>
                            <p className="field-help">Atlas watches supported workspace files and refreshes changed content. A changed embedding model requires rebuilding the index.</p>
                        </section>
                    )}

                    {tab === 'advanced' && (
                        <section aria-labelledby="settings-advanced">
                            <h3 id="settings-advanced">Advanced</h3>
                            <div className="settings-field">
                                <label htmlFor="system-prompt">Additional instruction</label>
                                <Textarea id="system-prompt" rows={6} value={draft.systemPrompt} onChange={event => set('systemPrompt', event.target.value)} />
                                <p className="field-help">Included in local prompts and in inspected OpenRouter payloads when cloud generation is selected.</p>
                            </div>
                            <InlineAlert title="Automatic updates unavailable" tone="info">Update signing is not configured in this build. Atlas will not claim or install automatic updates.</InlineAlert>
                            <div className="version-line"><Info size={14} /> Atlas 1.0.1</div>
                        </section>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
