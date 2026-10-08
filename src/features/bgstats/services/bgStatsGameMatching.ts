import { db } from '../../../db';
import { BggGame, GameTemplate, SavedListItem } from '../../../types';
import { BgStatsGame } from '../types';
import { normalizeBggId } from './bgStatsBggData';

type LocalGame = SavedListItem | GameTemplate;
const cleanName = (name: string) => name.trim().toLowerCase();

/** The preview and the actual game import share the same identity rules. */
export class BgStatsGameMatcher {
    private byId = new Map<string, LocalGame>();
    private byBggId = new Map<string, Map<string, LocalGame>>();
    private byName = new Map<string, Map<string, LocalGame>>();
    private aliasIds = new Map<string, Set<string>>();
    private relatedRows = new Map<string, LocalGame[]>();
    private savedIds: Set<string>;

    constructor(
        public readonly savedGames: SavedListItem[],
        dictionary: BggGame[],
        referencedTemplates: GameTemplate[] = []
    ) {
        this.savedIds = new Set(savedGames.map(game => game.id));
        for (const game of [...savedGames, ...referencedTemplates]) {
            const related = this.relatedRows.get(game.id) ?? [];
            related.push(game);
            this.relatedRows.set(game.id, related);
        }
        for (const [id, rows] of this.relatedRows) {
            const game = rows.find(row => normalizeBggId(row.bggId)) ?? rows[0];
            this.byId.set(id, game);
            const bggId = normalizeBggId(game.bggId);
            if (bggId) this.addIndex(this.byBggId, bggId, game);
            for (const row of rows) this.addIndex(this.byName, cleanName(row.name), game);
        }
        for (const entry of dictionary) {
            const id = normalizeBggId(entry.id);
            if (!id) continue;
            for (const name of [entry.name, ...(entry.altNames ?? [])]) {
                const key = cleanName(name);
                if (!key) continue;
                const ids = this.aliasIds.get(key) ?? new Set<string>();
                ids.add(id);
                this.aliasIds.set(key, ids);
            }
        }
    }

    private addIndex(index: Map<string, Map<string, LocalGame>>, key: string, game: LocalGame) {
        if (!key) return;
        const rows = index.get(key) ?? new Map<string, LocalGame>();
        rows.set(game.id, game);
        index.set(key, rows);
    }

    private firstByBggId(id: string): LocalGame | undefined {
        for (const game of this.byBggId.get(id)?.values() ?? []) {
            return this.byId.get(game.id) ?? game;
        }
        return undefined;
    }

    private uniqueCompatible(rows: LocalGame[], bggId: string | undefined): LocalGame | undefined {
        const compatible = rows.map(row => this.byId.get(row.id) ?? row).filter(row => {
            const localId = normalizeBggId(row.bggId);
            return !bggId || !localId || localId === bggId;
        });
        return compatible.length === 1 ? compatible[0] : undefined;
    }

    public needsBggFill(localId: string): boolean {
        const rows = this.relatedRows.get(localId) ?? [];
        // A template-only match also needs its saved-game identity created.
        return !this.savedIds.has(localId) ||
            rows.some(row => !normalizeBggId(row.bggId));
    }

    public rememberSaved(game: SavedListItem): void {
        this.savedIds.add(game.id);
        this.byId.set(game.id, game);
        this.relatedRows.set(game.id, [game]);
        this.addIndex(this.byName, cleanName(game.name), game);
        const bggId = normalizeBggId(game.bggId);
        if (bggId) this.addIndex(this.byBggId, bggId, game);
    }

    public async find(source: BgStatsGame): Promise<LocalGame | undefined> {
        const uuidMatch = this.byId.get(source.uuid);
        if (uuidMatch) return uuidMatch;

        const bggId = normalizeBggId(source.bggId);
        if (bggId) {
            const match = this.firstByBggId(bggId);
            if (match) return match;
        }

        const name = cleanName(source.name);
        const nameRows = [...(this.byName.get(name)?.values() ?? [])];
        const nameMatch = this.uniqueCompatible(nameRows, bggId);
        if (nameMatch) return nameMatch;
        if (nameRows.length) return undefined;

        const aliasIds = this.aliasIds.get(name);
        if (aliasIds?.size === 1) {
            const aliasId = [...aliasIds][0];
            if (!bggId || bggId === aliasId) {
                const match = this.firstByBggId(aliasId);
                if (match) return match;
            }
        }
        if (aliasIds && aliasIds.size > 1 && !bggId) return undefined;

        // Only the slow path queries template names; do not load all large scoreboards.
        const templates = await db.templates.where('name').equalsIgnoreCase(source.name.trim()).toArray();
        return this.uniqueCompatible(templates, bggId);
    }
}

export async function loadBgStatsGameMatcher(
    games: BgStatsGame[],
    savedGames?: SavedListItem[],
    dictionary?: BggGame[]
): Promise<BgStatsGameMatcher> {
    const uuids = [...new Set(games.map(game => game.uuid).filter(Boolean))];
    const [saved, templates, builtins] = await Promise.all([
        savedGames ? Promise.resolve(savedGames) : db.savedGames.toArray(),
        uuids.length ? db.templates.where('id').anyOf(uuids).toArray() : Promise.resolve([]),
        uuids.length ? db.builtins.where('id').anyOf(uuids).toArray() : Promise.resolve([])
    ]);
    const knownUuids = new Set([...saved, ...templates, ...builtins].map(row => row.id));
    const needsAliases = games.some(game => !normalizeBggId(game.bggId) && !knownUuids.has(game.uuid));
    const bgg = dictionary ?? (needsAliases ? await db.bggGames.toArray() : []);
    return new BgStatsGameMatcher(saved, bgg, [...templates, ...builtins]);
}
