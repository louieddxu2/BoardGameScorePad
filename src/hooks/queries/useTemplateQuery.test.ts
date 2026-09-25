import { renderHook } from '@testing-library/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate } from '../../types';
import { db } from '../../db';
import { LanguageProvider } from '../../i18n';
import { getAvailableImageIds, selectVisibleUserTemplates, useTemplateQuery } from './useTemplateQuery';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }));

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

describe('template query efficiency', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('keeps the default recent-template dependency stable across renders', () => {
        const recentDeps: unknown[] = [];
        vi.mocked(useLiveQuery).mockImplementation(((_query, deps, defaultResult) => {
            if (deps?.length === 3) recentDeps.push(deps[2]);
            return defaultResult;
        }) as typeof useLiveQuery);
        const pinnedIds: string[] = [];
        const { rerender } = renderHook(() => useTemplateQuery('', pinnedIds), {
            wrapper: LanguageProvider
        });

        rerender();

        expect(recentDeps).toHaveLength(2);
        expect(recentDeps[1]).toBe(recentDeps[0]);
    });

    it('skips image storage for templates without images', async () => {
        const where = vi.spyOn(db.images, 'where');

        expect(await getAvailableImageIds([simpleTemplate('pinned')])).toEqual(new Set());
        expect(where).not.toHaveBeenCalled();
    });

    it('checks only distinct image IDs used by visible templates', async () => {
        const primaryKeys = vi.fn(async () => ['image-1']);
        const anyOf = vi.fn(() => ({ primaryKeys }));
        const where = vi.spyOn(db.images, 'where').mockReturnValue({ anyOf } as any);
        const withImage = { ...simpleTemplate('first'), imageId: 'image-1' };

        expect(await getAvailableImageIds([withImage, { ...withImage, id: 'second' }])).toEqual(new Set(['image-1']));
        expect(where).toHaveBeenCalledWith('id');
        expect(anyOf).toHaveBeenCalledWith(['image-1']);
        expect(primaryKeys).toHaveBeenCalledOnce();
    });
});
