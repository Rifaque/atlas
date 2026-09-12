import type { ChatMessage } from './chats';

export function buildConversationHistory(
    messages: ChatMessage[],
    maxTurns = 20,
): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages.slice(-maxTurns).map(message => {
        let content = message.content;
        if (message.role === 'assistant') {
            const match = content.match(/(?:\n|^)\s*(?:FOLLOW_UP_SUGGESTIONS|Follow-up suggestions|Follow up suggestions|Follow-up question)s?\s*:?\s*(?:\n|$)/i);
            if (match?.index !== undefined) {
                content = content.slice(0, match.index).trimEnd();
            }
        }
        return { role: message.role, content };
    });
}
