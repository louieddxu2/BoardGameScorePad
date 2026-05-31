import { describe, it, expect, beforeEach } from 'vitest';
import { recordAiGenerationAttempt } from './aiUsageLimit';

describe('aiUsageLimit', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('allows five attempts within one hour and blocks the sixth', () => {
        const now = 100000;

        expect(recordAiGenerationAttempt(now)).toBe(true);
        expect(recordAiGenerationAttempt(now + 1)).toBe(true);
        expect(recordAiGenerationAttempt(now + 2)).toBe(true);
        expect(recordAiGenerationAttempt(now + 3)).toBe(true);
        expect(recordAiGenerationAttempt(now + 4)).toBe(true);
        expect(recordAiGenerationAttempt(now + 5)).toBe(false);
    });

    it('forgets attempts after the one-hour window', () => {
        const now = 100000;

        for (let i = 0; i < 5; i += 1) {
            expect(recordAiGenerationAttempt(now + i)).toBe(true);
        }

        expect(recordAiGenerationAttempt(now + 60 * 60 * 1000 + 1)).toBe(true);
    });
});
