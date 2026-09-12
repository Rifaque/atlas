import { describe, expect, it } from 'vitest';
import { buildConversationHistory } from './chatContext';

describe('buildConversationHistory', () => {
    it('keeps the previous real turn when the second question is sent', () => {
        const history = buildConversationHistory([
            { role: 'user', content: 'question 1' },
            { role: 'assistant', content: 'answer 1' },
        ]);
        expect(history).toEqual([
            { role: 'user', content: 'question 1' },
            { role: 'assistant', content: 'answer 1' },
        ]);
    });
});
