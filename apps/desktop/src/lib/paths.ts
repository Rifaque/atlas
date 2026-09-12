/**
 * Convert Windows extended-length paths to their familiar display form.
 * The canonical value must still be used for every backend request.
 */
export function displayPath(path: string): string {
    if (path.startsWith('\\\\?\\UNC\\')) return `\\\\${path.slice(8)}`;
    if (path.startsWith('\\\\?\\')) return path.slice(4);
    return path;
}
