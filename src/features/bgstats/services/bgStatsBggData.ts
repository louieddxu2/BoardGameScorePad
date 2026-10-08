import { BggGame, HistoryRecord } from '../../../types';
import { BgStatsGame } from '../types';

export function normalizeBggId(value: unknown): string | undefined {
    if (typeof value !== 'number' && typeof value !== 'string') return undefined;
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return undefined;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? String(id) : undefined;
}

export function getHistoryBggId(record: HistoryRecord): string | undefined {
    return normalizeBggId(record.bggId) ?? normalizeBggId(record.snapshotTemplate?.bggId);
}

/** Used inside Dexie's modify callback: only the ID fields and modification time change. */
export function fillHistoryBggId(record: HistoryRecord, incomingId: string, now: number): boolean {
    if (!normalizeBggId(incomingId)) return false;
    const bggId = getHistoryBggId(record) ?? normalizeBggId(incomingId);
    if (!bggId) return false;

    let changed = false;
    if (!normalizeBggId(record.bggId)) {
        record.bggId = bggId;
        changed = true;
    }
    const snapshot = record.snapshotTemplate;
    // Disposable/legacy plays can have no snapshot, or an array in its place.
    if (snapshot && !Array.isArray(snapshot) && !normalizeBggId(snapshot.bggId)) {
        snapshot.bggId = bggId;
        changed = true;
    }
    if (changed) record.updatedAt = now;
    return changed;
}

function nonEmptyText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function positiveNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const result = value.map(nonEmptyText).filter((item): item is string => !!item);
    return result.length ? result : undefined;
}

/** Missing-only merge; returning the original object means no database write is needed. */
export function mergeBggData(
    existing: BggGame | undefined,
    source: BgStatsGame,
    localName: string | undefined,
    now: number
): BggGame | undefined {
    const id = normalizeBggId(source.bggId);
    if (!id) return existing;

    const name = nonEmptyText(existing?.name) ?? nonEmptyText(source.bggName) ?? nonEmptyText(source.name) ?? '';
    const result: BggGame = existing ? { ...existing } : { id, name, updatedAt: now };
    let changed = !existing;
    if (!nonEmptyText(result.name) && name) {
        result.name = name;
        changed = true;
    }

    const aliases = [...(existing?.altNames ?? [])];
    const knownNames = new Set([name, ...aliases].map(n => n.trim().toLowerCase()));
    for (const value of [source.name, source.bggName, localName]) {
        const alias = nonEmptyText(value);
        if (alias && !knownNames.has(alias.toLowerCase())) {
            aliases.push(alias);
            knownNames.add(alias.toLowerCase());
        }
    }
    if (aliases.length !== (existing?.altNames?.length ?? 0)) {
        result.altNames = aliases;
        changed = true;
    }

    const numbers = {
        year: positiveNumber(source.bggYear),
        minPlayers: positiveNumber(source.minPlayerCount),
        maxPlayers: positiveNumber(source.maxPlayerCount),
        playingTime: positiveNumber(source.maxPlayTime),
        minAge: positiveNumber(source.minAge),
        complexity: positiveNumber(source.averageWeight),
        rank: positiveNumber(source.rank)
    };
    for (const key of Object.keys(numbers) as (keyof typeof numbers)[]) {
        const value = numbers[key];
        const current = result[key];
        if (value !== undefined && (typeof current !== 'number' || !Number.isFinite(current))) {
            result[key] = value;
            changed = true;
        }
    }
    const designers = nonEmptyText(source.designers);
    if (designers && !nonEmptyText(result.designers)) {
        result.designers = designers;
        changed = true;
    }
    for (const key of ['mechanisms', 'categories'] as const) {
        const value = stringList(source[key]);
        if (value && !stringList(result[key])) {
            result[key] = value;
            changed = true;
        }
    }
    if (typeof source.cooperative === 'boolean' && typeof result.cooperative !== 'boolean') {
        result.cooperative = source.cooperative;
        changed = true;
    }

    if (!changed) return existing;
    result.updatedAt = now;
    return result;
}
