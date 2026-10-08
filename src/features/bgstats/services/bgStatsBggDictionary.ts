import { db } from '../../../db';
import { BggGame } from '../../../types';
import { BgStatsGame } from '../types';
import { mergeBggData, normalizeBggId } from './bgStatsBggData';

/** Enrich every incoming BGG ID, including games whose local UUID needs no update. */
export async function enrichBggDictionary(
    games: BgStatsGame[],
    localNames = new Map<number, string>()
): Promise<void> {
    const sourcesById = new Map<string, BgStatsGame[]>();
    for (const game of games) {
        const id = normalizeBggId(game.bggId);
        if (!id) continue;
        const sources = sourcesById.get(id) ?? [];
        sources.push(game);
        sourcesById.set(id, sources);
    }

    const ids = [...sourcesById.keys()];
    const CHUNK_SIZE = 500;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        // Read and merge in the same short transaction, preserving concurrent local edits.
        await db.transaction('rw', db.bggGames, async () => {
            const existing = await db.bggGames.bulkGet(chunk);
            const changes: BggGame[] = [];
            const now = Date.now();
            chunk.forEach((id, index) => {
                let merged = existing[index];
                for (const source of sourcesById.get(id)!) {
                    merged = mergeBggData(merged, source, localNames.get(source.id), now);
                }
                if (merged && merged !== existing[index]) changes.push(merged);
            });
            if (changes.length) await db.bggGames.bulkPut(changes);
        });
    }
}
