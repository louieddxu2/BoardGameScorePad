
import { db } from '../../db';
import { HistoryRecord, SavedListItem } from '../../types';
import { Table } from 'dexie';
import { entityService } from '../entityService';
import { getRecordBggId, getRecordScoringRule } from '../../utils/historyUtils';
import { ResolvedEntity, EntityType } from './types';

export class TrainingContextResolver {

    /**
     * 解析歷史紀錄，回傳所有相關的實體
     */
    public async resolve(record: HistoryRecord, mode: 'full' | 'location_only'): Promise<ResolvedEntity[]> {
        const resolvedEntitiesMap = new Map<string, ResolvedEntity>();
        const isFull = mode === 'full';

        // Helper: 使用 EntityService 解析並快取結果
        const resolveAndCache = async (
            table: Table<SavedListItem>,
            name: string,
            type: EntityType,
            forceNewContext: boolean,
            preferredId?: string,
            externalIds?: { bggId?: string, bgStatsId?: string }
        ) => {
            if (!name) return;

            // 固定 ID 的實體 (時間、人數、模式、SessionContext) 不走複雜解析
            if (['weekday', 'timeslot', 'playerCount', 'gameMode', 'sessionContext'].includes(type)) {
                let item = await table.get(preferredId!);
                if (!item) {
                    item = {
                        id: preferredId!,
                        name: name,
                        lastUsed: 0,
                        usageCount: 0,
                        meta: { relations: {} }
                    };
                    await table.add(item);
                }
                if (!resolvedEntitiesMap.has(item.id)) {
                    resolvedEntitiesMap.set(item.id, { item, table, type, isNewContext: forceNewContext });
                }
                return;
            }

            // 一般實體使用 EntityService
            const item = await entityService.resolveOrCreate(table, name, type as any, preferredId, externalIds);

            if (item && !resolvedEntitiesMap.has(item.id)) {
                resolvedEntitiesMap.set(item.id, { item, table, type, isNewContext: forceNewContext });
            }
        };

        // A. Location
        if (record.location) {
            await resolveAndCache(
                db.savedLocations,
                record.location,
                'location',
                true, // Location is always a context provider
                record.locationId,
                { bgStatsId: undefined }
            );
        }

        // B. Game
        const bggId = getRecordBggId(record);

        await resolveAndCache(
            db.savedGames,
            record.gameName,
            'game',
            isFull,
            undefined,
            { bggId }
        );

        // C. Players
        const validPlayers = record.players.filter(p => {
            const isSlotId = p.id.startsWith('slot_') || p.id.startsWith('player_');
            const isSystemId = p.id.startsWith('sys_player_');
            const isDefaultName = /^(玩家|Player)\s?\d+$/.test(p.name);

            if ((isSlotId || isSystemId) && isDefaultName && !p.linkedPlayerId) return false;
            return true;
        });

        for (const p of validPlayers) {
            const isPlaceholderId = p.id.startsWith('slot_') || p.id.startsWith('player_') || p.id.startsWith('sys_');
            const targetId = p.linkedPlayerId || (!isPlaceholderId ? p.id : undefined);

            await resolveAndCache(db.savedPlayers, p.name, 'player', isFull, targetId);
        }

        // D. Time & Count & Game Mode
        const date = new Date(record.endTime);
        const dayIndex = date.getDay();
        const hour = date.getHours();
        const slotIndex = Math.floor(hour / 3);
        const startH = String(slotIndex * 3).padStart(2, '0');
        const endH = String((slotIndex + 1) * 3).padStart(2, '0');
        const timeSlotName = `${startH}-${endH}`;
        const playerCount = record.players.length;
        const scoringRule = getRecordScoringRule(record);

        await resolveAndCache(db.savedWeekdays, dayIndex.toString(), 'weekday', isFull, `weekday_${dayIndex}`);
        await resolveAndCache(db.savedTimeSlots, timeSlotName, 'timeslot', isFull, `timeslot_${slotIndex}`);
        if (playerCount > 0) {
            await resolveAndCache(db.savedPlayerCounts, playerCount.toString(), 'playerCount', isFull, `count_${playerCount}`);
        }
        await resolveAndCache(db.savedGameModes, scoringRule, 'gameMode', isFull, scoringRule);

        // E. Current Session Context
        await resolveAndCache(db.savedCurrentSession, 'Current Session', 'sessionContext', true, 'current_session');

        return Array.from(resolvedEntitiesMap.values());
    }
}

export const trainingContextResolver = new TrainingContextResolver();
