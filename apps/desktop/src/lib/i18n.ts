import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        resources: {
            en: {
                translation: {
                    common: {
                        cancel: 'Cancel',
                        save: 'Save',
                        done: 'Done',
                        error: 'Error',
                        retry: 'Retry',
                    },
                    chat: {
                        placeholder: 'Ask about your codebase...',
                        stop: 'Stop Generation',
                        newChat: 'New Chat',
                        export: 'Export Chat',
                        delete: 'Delete Chat',
                        thinking: 'Thinking...',
                        thoughtProcess: 'Thought Process',
                    },
                    workspace: {
                        switch: 'Switch Workspace',
                        architecture: 'Architecture',
                        graph: 'Graph',
                        context: 'Context',
                        files: 'Files',
                        search: 'Search',
                    },
                    settings: {
                        title: 'Settings',
                        general: 'General',
                        models: 'Models',
                        system: 'System',
                        theme: 'Theme',
                        accent: 'Accent Color',
                    }
                }
            }
        }
    });

export default i18n;
