import { describe, expect, it } from 'vitest';
import { displayPath } from './paths';

describe('displayPath', () => {
    it('removes a Windows extended-length prefix without changing identity data', () => {
        expect(displayPath('\\\\?\\C:\\work\\atlas')).toBe('C:\\work\\atlas');
    });

    it('preserves the familiar UNC prefix', () => {
        expect(displayPath('\\\\?\\UNC\\server\\share\\atlas')).toBe('\\\\server\\share\\atlas');
    });

    it('leaves ordinary paths untouched', () => {
        expect(displayPath('/work/atlas')).toBe('/work/atlas');
    });
});
