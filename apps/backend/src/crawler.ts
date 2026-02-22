import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ignore from 'ignore';

export const ALLOWED_EXTENSIONS = new Set([
    '.txt', '.md', '.py', '.js', '.ts', '.jsx', '.tsx',
    '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs',
    '.rb', '.php', '.swift', '.kt', '.scala',
    '.json', '.yaml', '.yml', '.toml', '.env',
    '.pdf', '.docx', '.csv', '.log', '.sql', '.html', '.css', '.xml',
]);

export const DEFAULT_IGNORES = [
    'node_modules/', '.git/', '.atlas/', 'dist/', 'build/',
    'coverage/', '.next/', 'out/', 'target/', 'vendor/', 'tmp/',
    '.venv/', 'venv/', '__pycache__/', '.mypy_cache/', '.pytest_cache/',
    '.turbo/', '.cache/', 'storybook-static/', '*.min.js', '*.min.css'
];

// Skip files larger than 10 MB (generated/minified bundles, lock files, etc.)
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface FileData {
    filePath: string;
    content: string;
}

export async function parseFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);

        // Suppress noisy TrueType font warnings from pdf-parse internals
        const origWarn = console.warn;
        console.warn = (...args: any[]) => {
            const msg = args.map(String).join(' ');
            if (msg.includes('Warning: TT:') || msg.includes('Warning: ')) return;
            origWarn.apply(console, args);
        };

        try {
            const data = await pdfParse(dataBuffer);
            return data.text;
        } catch (err: any) {
            // Corrupted / malformed PDF — log a concise warning and skip
            const reason = err?.message || String(err);
            origWarn(`[crawler] Skipping corrupted PDF (${reason.split('\n')[0]}): ${path.basename(filePath)}`);
            return '';
        } finally {
            console.warn = origWarn;
        }
    }

    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    // Return plain text for text/code files
    return await fs.readFile(filePath, 'utf-8');
}

export async function crawlDirectory(
    dir: string,
    onFileFound: (file: FileData) => Promise<void>
): Promise<number> {
    const ig = ignore().add(DEFAULT_IGNORES);

    try {
        const gitignorePath = path.join(dir, '.gitignore');
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        ig.add(gitignoreContent);
    } catch {
        // No .gitignore found, proceed with defaults
    }

    let fileCount = 0;

    async function walk(currentDir: string): Promise<void> {
        try {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.relative(dir, fullPath);
                const posixPath = relPath.split(path.sep).join(path.posix.sep) + (entry.isDirectory() ? '/' : '');

                if (ig.ignores(posixPath)) continue;

                if (entry.isDirectory()) {
                    if (!entry.name.startsWith('.')) {
                        await walk(fullPath);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(fullPath).toLowerCase();
                    if (ALLOWED_EXTENSIONS.has(ext)) {
                        try {
                            const stat = await fs.stat(fullPath);
                            if (stat.size > MAX_FILE_BYTES) {
                                console.warn(`[crawler] Skipping large file (${(stat.size / 1e6).toFixed(1)} MB): ${fullPath}`);
                                continue;
                            }

                            const content = await parseFile(fullPath);
                            if (content.trim().length === 0) continue;

                            await onFileFound({ filePath: fullPath, content });
                            fileCount++;
                        } catch (err) {
                            console.error(`[crawler] Error parsing file: ${fullPath}`, err);
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`[crawler] Error reading directory: ${currentDir}`, err);
        }
    }

    await walk(dir);
    return fileCount;
}
