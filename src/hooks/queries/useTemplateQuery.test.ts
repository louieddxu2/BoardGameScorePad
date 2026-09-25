import { describe, expect, it } from 'vitest';
import type { GameTemplate } from '../../types';
import { selectVisibleUserTemplates } from './useTemplateQuery';

const simpleTemplate = (id: string): GameTemplate => ({
    id,
    name: id,
    columns: [],
    createdAt: 1
} as GameTemplate);

describe('selectVisibleUserTemplates', () => {
    it('keeps pinned simple templates fetched by ID beyond the regular fetch cap', () => {
        const newestTemplate = {
            ...simpleTemplate('newest'),
            columns: [{ id: 'score', name: 'Score', formula: 'a1', inputType: 'keypad' as const, isScoring: true }]
        } as GameTemplate;
        const olderPinnedTemplate = simpleTemplate('older-pinned');
        const olderUnpinnedTemplate = simpleTemplate('older-unpinned');

        const visible = selectVisibleUserTemplates(
            [newestTemplate],
            [olderPinnedTemplate, olderUnpinnedTemplate],
            [olderPinnedTemplate.id]
        );

        expect(visible).toEqual([newestTemplate, olderPinnedTemplate]);
    });

    it('does not duplicate a pinned template already in the regular query results', () => {
        const pinnedTemplate = simpleTemplate('pinned');

        const visible = selectVisibleUserTemplates(
            [pinnedTemplate],
            [pinnedTemplate],
            [pinnedTemplate.id]
        );

        expect(visible).toEqual([pinnedTemplate]);
    });
});
