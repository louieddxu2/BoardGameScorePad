import type { Table } from 'dexie';
import { db } from '../../../db';
import type { SavedListItem } from '../../../types';

/**
 * 記住 BG Stats 項目（玩家、地點、遊戲）與本機項目的對應。
 *
 * 新建的本機項目直接以 BG Stats uuid 為 id，不需要另外記錄；
 * 連結到既有本機項目時（手動連結、名稱或 BGG ID 配對），把來源 uuid 存在本機項目的
 * `meta.bgStatsUuids`，下次匯入同一個來源項目時直接對應回去，不會再建立重複項目。
 */

export const sourceUuidsOf = (item: SavedListItem | undefined): string[] => {
    const value = item?.meta?.bgStatsUuids;
    return Array.isArray(value) ? value.filter((uuid): uuid is string => typeof uuid === 'string' && !!uuid) : [];
};

/** 來源 uuid → 記住它的本機項目。 */
export const buildSourceLinkIndex = <T extends SavedListItem>(items: T[]): Map<string, T> => {
    const index = new Map<string, T>();
    for (const item of items) {
        for (const uuid of sourceUuidsOf(item)) index.set(uuid, item);
    }
    return index;
};

/**
 * 寫入本次匯入解析出的對應（來源 uuid → 本機 id）。
 * 同一個來源 uuid 只屬於一個本機項目：改連到別的項目時，從原本的項目移除；
 * 對應到以該 uuid 為 id 的項目時不需記錄。
 * `createName` 提供本機還沒有清單項目時（例如只有計分板的遊戲）要建立的名稱。
 */
export async function rememberSourceLinks(
    table: Table<SavedListItem>,
    resolved: Map<string, string>,
    previous: Map<string, SavedListItem>,
    createName?: (localId: string) => string | undefined,
): Promise<void> {
    const adds = new Map<string, Set<string>>();
    const removes = new Map<string, Set<string>>();
    const mark = (index: Map<string, Set<string>>, id: string, uuid: string) => {
        const set = index.get(id) ?? new Set<string>();
        set.add(uuid);
        index.set(id, set);
    };
    for (const [uuid, localId] of resolved) {
        const holder = previous.get(uuid);
        if (holder && holder.id !== localId) mark(removes, holder.id, uuid);
        if (localId !== uuid && holder?.id !== localId) mark(adds, localId, uuid);
    }
    const ids = [...new Set([...adds.keys(), ...removes.keys()])];
    if (!ids.length) return;

    await db.transaction('rw', table, async () => {
        const rows = await table.bulkGet(ids);
        const updated: SavedListItem[] = [];
        for (const [i, id] of ids.entries()) {
            let row = rows[i];
            if (!row) {
                const name = adds.has(id) ? createName?.(id)?.trim() : undefined;
                // Names are unique in the saved lists; never let a new row collide with another one.
                if (!name || await table.where('name').equals(name).first()) continue;
                row = { id, name, lastUsed: 0, usageCount: 0, meta: { relations: {}, confidence: {} } };
            }
            const uuids = new Set(sourceUuidsOf(row));
            removes.get(id)?.forEach(uuid => uuids.delete(uuid));
            adds.get(id)?.forEach(uuid => uuids.add(uuid));
            updated.push({ ...row, meta: { ...row.meta, bgStatsUuids: [...uuids] } });
        }
        if (updated.length) await table.bulkPut(updated);
    });
}

/** 匯出時使用的 uuid：連結過 BG Stats 項目時用記住的來源 uuid，否則用本機 id。 */
export const exportUuidOf = (item: SavedListItem | undefined, localId: string): string =>
    sourceUuidsOf(item)[0] ?? localId;
