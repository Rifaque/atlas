export type AppErrorCode =
    | 'WorkspaceUnavailable'
    | 'IndexRequired'
    | 'IndexFailed'
    | 'EmbeddingProviderUnavailable'
    | 'GenerationProviderUnavailable'
    | 'InvalidModel'
    | 'NoRelevantEvidence'
    | 'CloudAuthorizationRequired'
    | 'CloudPayloadBlocked'
    | 'FileUnavailable'
    | 'PersistenceCorrupt'
    | 'UpdateUnavailable'
    | 'Unexpected';

export interface AppError {
    code: AppErrorCode;
    message: string;
}

export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
        return error;
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }

    return fallback;
}
