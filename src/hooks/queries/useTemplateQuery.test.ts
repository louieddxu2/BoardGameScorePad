import { renderHook } from '@testing-library/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate } from '../../types';
import { db } from '../../db';
import { LanguageProvider } from '../../i18n';
import { getAvailableImageIds, selectUserTemplateVisibility, useTemplateQuery } from './useTemplateQuery';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }));

const simpleTemplate = (id: string): GameTemplate => ({
    id,
    name: id,
    columns: [],
    createdAt: 1
} as GameTemplate);

describe('selectUserTemplateVisibility', () => {
    it('retains filtered simple-board identities for name ambiguity checks', () => {
        const fullTemplate = {
            ...simpleTemplate('full'),
            name: 'Shared Name',
            columns: [{ id: 'score', name: 'Score', formula: 'a1', inputType: 'keypad' as const, isScoring: true }]
        } as GameTemplate;
        const hiddenSimple = { ...simpleTemplate('hidden'), name: 'Shared Name', bggId: '456' };
        const pinnedSimple = { ...simpleTemplate('pinned'), name: 'Pinned Name' };

        const { visibleItems, hiddenTemplateIdentities } = selectUserTemplateVisibility(
            [fullTemplate, hiddenSimple, pinnedSimple], [], [pinnedSimple.id]
        );

        expect(visibleItems).toEqual([fullTemplate, pinnedSimple]);
        expect(hiddenTemplateIdentities).toEqual([{ id: 'hidden', name: 'Shared Name', bggId: '456' }]);
    });

    it('keeps pinned simple templates fetched by ID beyond the regular fetch cap', () => {
        const newestTemplate = {
            ...simpleTemplate('newest'),
            columns: [{ id: 'score', name: 'Score', formula: 'a1', inputType: 'keypad' as const, isScoring: true }]
        } as GameTemplate;
        const olderPinnedTemplate = simpleTemplate('older-pinned');
        const olderUnpinnedTemplate = simpleTemplate('older-unpinned');

        const { visibleItems: visible } = selectUserTemplateVisibility(
            [newestTemplate],
            [olderPinnedTemplate, olderUnpinnedTemplate],
            [olderPinnedTemplate.id]
        );

        expect(visible).toEqual([newestTemplate, olderPinnedTemplate]);
    });

    it('does not duplicate a pinned template already in the regular query results', () => {
        const pinnedTemplate = simpleTemplate('pinned');

        const { visibleItems: visible } = selectUserTemplateVisibility(
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

describe('recent template identity lookup', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('skips name-based lookup for an ambiguous recent game', async () => {
        vi.spyOn(db.templates, 'get').mockResolvedValue(undefined);
        vi.spyOn(db.builtins, 'get').mockResolvedValue(undefined);
        const userWhere = vi.spyOn(db.templates, 'where');
        const builtinWhere = vi.spyOn(db.builtins, 'where');
        const { result } = renderHook(() => useTemplateQuery('', []), { wrapper: LanguageProvider });

        expect(await result.current.getTemplate('shortcut:saved-game', {
            gameName: 'Shared Name', ambiguousName: true
        })).toBeNull();
        expect(userWhere).not.toHaveBeenCalled();
        expect(builtinWhere).not.toHaveBeenCalled();
    });

    it('still accepts a direct template ID when the name is ambiguous', async () => {
        const matching = simpleTemplate('known-id');
        vi.spyOn(db.templates, 'get').mockResolvedValue(matching);
        const { result } = renderHook(() => useTemplateQuery('', []), { wrapper: LanguageProvider });

        expect(await result.current.getTemplate('known-id', {
            gameName: 'Shared Name', ambiguousName: true
        })).toEqual(matching);
    });

    it('uses indexed candidate and catalog lookups for a loading-state shortcut', async () => {
        const board = { ...simpleTemplate('board-123'), name: 'Shared Name', bggId: '123' };
        const catalogIds = ['123'];
        vi.spyOn(db.templates, 'get').mockResolvedValue(undefined);
        vi.spyOn(db.builtins, 'get').mockResolvedValue(undefined);
        vi.spyOn(db.templates, 'where').mockReturnValue({
            equalsIgnoreCase: () => ({ toArray: async () => [board] })
        } as any);
        vi.spyOn(db.builtins, 'where').mockReturnValue({
            equalsIgnoreCase: () => ({ toArray: async () => [] })
        } as any);
        const bggWhere = vi.spyOn(db.bggGames, 'where').mockImplementation((field) => ({
            equalsIgnoreCase: () => ({
                toArray: async () => String(field) === 'name' ? catalogIds.map(id => ({ id })) : []
            })
        }) as any);
        const { result } = renderHook(() => useTemplateQuery('', []), { wrapper: LanguageProvider });
        const identity = { gameName: 'Shared Name', ambiguousName: true, nameMatchPending: true };

        expect(await result.current.getTemplate('shortcut:saved-game', identity)).toEqual(board);
        expect(bggWhere).toHaveBeenCalledWith('name');
        expect(bggWhere).toHaveBeenCalledWith('altNames');

        catalogIds[0] = '456';
        expect(await result.current.getTemplate('shortcut:saved-game', identity)).toBeNull();

        catalogIds[0] = '123';
        catalogIds.push('456');
        expect(await result.current.getTemplate('shortcut:saved-game', identity)).toBeNull();
    });
});
