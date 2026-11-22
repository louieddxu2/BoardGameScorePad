
import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { GameTemplate, TemplatePreference } from '../../types';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { extractTemplateSummary, TemplateSummary } from '../../utils/extractDataSummaries';
import { isDisposableTemplate } from '../../utils/templateUtils';
import { toBuiltinFullId, toBuiltinShortId } from '../../utils/deepLink';
import { useAppTranslation } from '../../i18n/app';
import { resolveRecentGameTemplate } from '../../utils/recentTemplateResolution';
import type { RecentGameTemplateIdentity } from '../../utils/recentTemplateResolution';

interface TemplateSummaryData {
    templates: TemplateSummary[];
    shareableTemplateIds: string[];
    hiddenTemplateIdentities?: Pick<GameTemplate, 'id' | 'name' | 'bggId'>[];
}

const EMPTY_TEMPLATE_SUMMARIES: TemplateSummary[] = [];
const EMPTY_TEMPLATE_IDENTITIES: Pick<GameTemplate, 'id' | 'name' | 'bggId'>[] = [];

export const selectUserTemplateVisibility = (
    rawItems: GameTemplate[],
    additionalTemplates: GameTemplate[],
    pinnedIds: string[]
): { visibleItems: GameTemplate[]; hiddenTemplateIdentities: Pick<GameTemplate, 'id' | 'name' | 'bggId'>[] } => {
    const loadedIds = new Set(rawItems.map(template => template.id));
    const visibleItems: GameTemplate[] = [];
    const hiddenTemplateIdentities: Pick<GameTemplate, 'id' | 'name' | 'bggId'>[] = [];
    for (const template of rawItems) {
        if (isDisposableTemplate(template, pinnedIds)) {
            hiddenTemplateIdentities.push({ id: template.id, name: template.name, bggId: template.bggId });
        } else {
            visibleItems.push(template);
        }
    }
    const missingPinnedItems = additionalTemplates.filter(template =>
        pinnedIds.includes(template.id) &&
        !loadedIds.has(template.id) &&
        !isDisposableTemplate(template, pinnedIds)
    );

    return { visibleItems: [...visibleItems, ...missingPinnedItems], hiddenTemplateIdentities };
};

export const getAvailableImageIds = async (templates: GameTemplate[]): Promise<Set<string>> => {
    const imageIds = [...new Set(templates.flatMap(template => template.imageId ? [template.imageId] : []))];
    if (imageIds.length === 0) return new Set();
    const existingIds = await db.images.where('id').anyOf(imageIds).primaryKeys();
    return new Set(existingIds as string[]);
};

const buildTemplateView = (
    users: TemplateSummary[],
    builtins: TemplateSummary[],
    searchQuery: string,
    mergePrefs: (template: TemplateSummary) => GameTemplate,
) => {
    const templates: GameTemplate[] = [];
    const systemOverrides: Record<string, GameTemplate> = {};
    const searchNames = [{ name: '_searchName', weight: 1 }];
    const matches = <T extends TemplateSummary>(items: T[]): T[] => searchQuery.trim()
        ? searchService.search(items, searchQuery, searchNames)
        : items;
    for (const template of matches(users)) {
        const merged = mergePrefs(template);
        if (merged.sourceTemplateId) systemOverrides[merged.sourceTemplateId] = merged;
        else templates.push(merged);
    }
    const systemTemplates = matches(builtins).map(template => systemOverrides[template.id] ?? mergePrefs(template));
    return { templates, systemTemplates, systemOverrides };
};

export const useTemplateQuery = (
    searchQuery: string,
    pinnedIds: string[],
    enabled = true,
) => {
    // --- PREFERENCES & HELPERS ---
    const allPrefs = useLiveQuery(() => db.templatePrefs.toArray(), [], []);

    const prefsMap = useMemo(() => {
        const map: Record<string, TemplatePreference> = {};
        allPrefs?.forEach(p => { map[p.templateId] = p; });
        return map;
    }, [allPrefs]);

    const mergePrefs = useCallback((template: GameTemplate | TemplateSummary) => {
        const pref = prefsMap[template.id];
        const sourcePref = template.sourceTemplateId ? prefsMap[template.sourceTemplateId] : undefined;

        if (!pref && !sourcePref) return template as GameTemplate;

        return {
            ...template,
            lastPlayerCount: pref?.lastPlayerCount ?? sourcePref?.lastPlayerCount ?? template.lastPlayerCount,
            defaultScoringRule: pref?.defaultScoringRule ?? sourcePref?.defaultScoringRule ?? template.defaultScoringRule
        } as GameTemplate;
    }, [prefsMap]);

    const getTemplate = async (id: string, identity?: RecentGameTemplateIdentity): Promise<GameTemplate | null> => {
        let t = await db.templates.get(id);
        if (t) return mergePrefs(t);
        t = await db.builtins.get(id);
        if (t) return mergePrefs(t);

        if (!identity || (identity.ambiguousName && !identity.nameMatchPending) || !identity.gameName.trim()) return null;
        const gameName = identity.gameName.trim();

        // Name is indexed on both tables, so an ID-repair lookup stays bounded to
        // same-name candidates instead of scanning the template library.
        const [userCandidates, builtinCandidates] = await Promise.all([
            db.templates.where('name').equalsIgnoreCase(gameName).toArray(),
            db.builtins.where('name').equalsIgnoreCase(gameName).toArray()
        ]);
        const resolved = resolveRecentGameTemplate(
            [...userCandidates, ...builtinCandidates],
            identity.nameMatchPending ? { ...identity, ambiguousName: false } : identity
        );
        if (!resolved) return null;
        if (identity.nameMatchPending) {
            // While the catalog query is loading, check its indexed names at click time
            // before trusting a unique same-name board.
            const [primaryGames, aliasGames] = await Promise.all([
                db.bggGames.where('name').equalsIgnoreCase(gameName).toArray(),
                db.bggGames.where('altNames').equalsIgnoreCase(gameName).toArray()
            ]);
            const catalogIds = new Set([...primaryGames, ...aliasGames].map(game => game.id.trim().toLowerCase()));
            const boardId = resolved.bggId?.trim().toLowerCase();
            if (catalogIds.size > 1 || (catalogIds.size === 1 && boardId && !catalogIds.has(boardId))) return null;
        }
        return mergePrefs(resolved);
    };

    // --- TEMPLATES (User) ---
    const allUserTemplatesData = useLiveQuery<TemplateSummaryData | undefined>(async () => {
        if (!enabled) return undefined;
        let collection = db.templates.orderBy('updatedAt').reverse();
        const fetchLimit = DATA_LIMITS.QUERY.FETCH_CAP;

        const rawItems = await collection.limit(fetchLimit).toArray();

        // Pinned boards must also be visible beyond the library's query limit.
        const loadedIds = new Set(rawItems.map(template => template.id));
        const lookupIds = [...new Set(pinnedIds)].filter(id => !loadedIds.has(id));
        const additionalTemplates = lookupIds.length > 0
            ? (await db.templates.bulkGet(lookupIds)).filter((template): template is GameTemplate => template !== undefined)
            : [];
        const { visibleItems, hiddenTemplateIdentities } = selectUserTemplateVisibility(rawItems, additionalTemplates, pinnedIds);
        const shareabilityCandidates = [...rawItems, ...additionalTemplates];
        const imageSet = await getAvailableImageIds(visibleItems);

        // Inject properties using centralized extractor
        const mappedItems = visibleItems.map(t => extractTemplateSummary(t, imageSet));

        return {
            templates: mappedItems,
            hiddenTemplateIdentities,
            shareableTemplateIds: shareabilityCandidates.filter(template => !isDisposableTemplate(template)).map(template => template.id)
        };
    }, [enabled, pinnedIds]);


    const { t: tApp } = useAppTranslation();

    // --- TEMPLATES (Built-in) ---
    const allBuiltinsRaw = useLiveQuery<TemplateSummaryData | undefined>(async () => {
        if (!enabled) return undefined;
        const raw = await db.builtins.toArray();
        // Standardize Built-ins to TemplateSummary for consistent search architecture
        return {
            templates: raw.map(t => extractTemplateSummary(t, new Set())),
            shareableTemplateIds: raw.filter(template => !isDisposableTemplate(template)).map(template => template.id)
        };
    }, [enabled]);

    // Depend on the language code, not tApp: the translation hook returns a new function on every
    // render, which would rebuild this list (and every list derived from it) each time.
    const langCode = tApp('app_lang_code') || 'zh-TW';
    const allBuiltinsData = useMemo<TemplateSummary[]>(() => {
        if (!allBuiltinsRaw) return EMPTY_TEMPLATE_SUMMARIES;
        const isEn = langCode.startsWith('en');

        return allBuiltinsRaw.templates.filter(t => {
             const isEnTemplate = t.id.startsWith('Built-in-EN-');
             return isEn ? isEnTemplate : !isEnTemplate;
        });
    }, [allBuiltinsRaw, langCode]);

    const getBuiltinTemplateByShortId = async (shortId: string): Promise<GameTemplate | null> => {
        // 1. Try direct lookup (fastest)
        const fullId = toBuiltinFullId(shortId);
        let template = await db.builtins.get(fullId);

        // 2. Fallback: Case-insensitive search (handles built-in- vs Built-in- and slug variations)
        if (!template) {
            const normalizedShort = shortId.toLowerCase();
            template = await db.builtins
                .filter(t => toBuiltinShortId(t.id).toLowerCase() === normalizedShort)
                .first();
        }

        if (!template) return null;
        return mergePrefs(template);
    };

    const userSummaries = allUserTemplatesData?.templates ?? EMPTY_TEMPLATE_SUMMARIES;
    const unfiltered = useMemo(() => buildTemplateView(userSummaries, allBuiltinsData, '', mergePrefs),
        [userSummaries, allBuiltinsData, mergePrefs]);
    const visible = useMemo(() => searchQuery.trim()
        ? buildTemplateView(userSummaries, allBuiltinsData, searchQuery, mergePrefs)
        : unfiltered, [searchQuery, userSummaries, allBuiltinsData, mergePrefs, unfiltered]);

    const shareableTemplateIds = useMemo(() => new Set([
        ...(allUserTemplatesData?.shareableTemplateIds ?? []),
        ...(allBuiltinsRaw?.shareableTemplateIds ?? [])
    ]), [allUserTemplatesData, allBuiltinsRaw]);

    return {
        ...visible,
        unfiltered,
        hiddenTemplateIdentities: allUserTemplatesData?.hiddenTemplateIdentities ?? EMPTY_TEMPLATE_IDENTITIES,
        templatesLoaded: allUserTemplatesData !== undefined && allBuiltinsRaw !== undefined,
        userTemplatesCount: visible.templates.length,
        systemTemplatesCount: visible.systemTemplates.length,
        shareableTemplateIds,
        getTemplate,
        getBuiltinTemplateByShortId
    };
};
