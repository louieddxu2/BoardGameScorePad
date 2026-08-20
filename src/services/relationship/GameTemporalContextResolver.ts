import { Table } from 'dexie';
import { db } from '../../db';
import { HistoryRecord, SavedListItem } from '../../types';
import { getRecordBggId } from '../../utils/historyUtils';
import { ResolvedEntity } from './types';

export const GAME_PLAY_STAGE_BUCKET_IDS = [
    'game_play_stage:first',
    'game_play_stage:second',
    'game_play_stage:third_to_fourth',
    'game_play_stage:fifth_to_ninth',
    'game_play_stage:tenth_plus'
] as const;

export const GAME_RECENCY_BUCKET_IDS = [
    'game_recency:within_1_day',
    'game_recency:within_7_days',
    'game_recency:within_30_days',
    'game_recency:within_90_days',
    'game_recency:over_90_days'
] as const;

export const GAME_LIFECYCLE_BUCKET_IDS = [...GAME_PLAY_STAGE_BUCKET_IDS, ...GAME_RECENCY_BUCKET_IDS] as const;
export const GAME_LIFECYCLE_RELATION_TARGET_SCOPE = [
    'players',
    'locations',
    'weekdays',
    'timeSlots',
    'playerCounts',
    'gameModes'
] as const;
export type GamePlayStageBucketId = typeof GAME_PLAY_STAGE_BUCKET_IDS[number];
export type GameRecencyBucketId = typeof GAME_RECENCY_BUCKET_IDS[number];

export interface GameTemporalContext {
    priorCount: number;
    lastCompletedAt?: number;
    stageBucketId: GamePlayStageBucketId;
    recencyBucketId?: GameRecencyBucketId;
}

export interface GameTemporalRunningState {
    completedCount: number;
    lastCompletedAt?: number;
    pending: Array<{ endTime: number; id: string }>;
    currentStartTime?: number;
    sameStartPending: Array<{ endTime: number; id: string }>;
}

const DAY = 24 * 60 * 60 * 1000;

export function normalizeGameName(name?: string): string {
    return (name || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function sortHistoryRecordsStable<T extends Pick<HistoryRecord, 'startTime' | 'endTime' | 'id'>>(records: T[]): T[] {
    return [...records].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id));
}

export function classifyGamePlayStage(priorCount: number): GamePlayStageBucketId {
    if (priorCount === 0) return 'game_play_stage:first';
    if (priorCount === 1) return 'game_play_stage:second';
    if (priorCount <= 3) return 'game_play_stage:third_to_fourth';
    if (priorCount <= 8) return 'game_play_stage:fifth_to_ninth';
    return 'game_play_stage:tenth_plus';
}

export function classifyGameRecency(elapsedMs: number): GameRecencyBucketId {
    if (elapsedMs <= DAY) return 'game_recency:within_1_day';
    if (elapsedMs <= 7 * DAY) return 'game_recency:within_7_days';
    if (elapsedMs <= 30 * DAY) return 'game_recency:within_30_days';
    if (elapsedMs <= 90 * DAY) return 'game_recency:within_90_days';
    return 'game_recency:over_90_days';
}

export function classifyGameTemporalContext(priorCount: number, referenceStartTime: number, lastCompletedAt?: number): GameTemporalContext {
    return {
        priorCount,
        lastCompletedAt,
        stageBucketId: classifyGamePlayStage(priorCount),
        recencyBucketId: priorCount > 0 && lastCompletedAt !== undefined
            ? classifyGameRecency(referenceStartTime - lastCompletedAt)
            : undefined
    };
}

export function createLifecycleBucketItems(): SavedListItem[] {
    return GAME_LIFECYCLE_BUCKET_IDS.map(id => ({
        id,
        name: id,
        lastUsed: 0,
        usageCount: 0,
        meta: { relations: {}, confidence: {} }
    }));
}

export class GameTemporalContextResolver {
    public resolveFromSavedGameStats(savedGame: SavedListItem | undefined, referenceStartTime: number): GameTemporalContext {
        const priorCount = savedGame?.usageCount ?? 0;
        const lastCompletedAt = priorCount > 0 ? savedGame?.lastUsed : undefined;
        return classifyGameTemporalContext(priorCount, referenceStartTime, lastCompletedAt);
    }

    public resolveIdentity(input: { bggId?: string; gameName?: string; templateId?: string }, resolvedGame?: SavedListItem): string {
        const bggId = input.bggId || resolvedGame?.bggId;
        if (bggId) return `bgg:${bggId}`;
        if (resolvedGame?.id) return `game:${resolvedGame.id}`;
        if (input.templateId) return `game:${input.templateId}`;
        return `name:${normalizeGameName(input.gameName || resolvedGame?.name)}`;
    }

    public recordsMatchGame(record: HistoryRecord, identity: string, resolvedGame?: SavedListItem): boolean {
        const expectedBggId = identity.startsWith('bgg:') ? identity.slice(4) : resolvedGame?.bggId;
        const recordBggId = getRecordBggId(record);
        if (expectedBggId && recordBggId) return expectedBggId === recordBggId;

        if (identity.startsWith('game:') && record.templateId === identity.slice(5)) return true;
        return normalizeGameName(record.gameName) === normalizeGameName(resolvedGame?.name || identity.replace(/^name:/, ''));
    }

    public async resolveFromHistory(args: {
        referenceStartTime: number;
        currentRecordId?: string;
        bggId?: string;
        gameName?: string;
        templateId?: string;
        resolvedGame?: SavedListItem;
    }): Promise<GameTemporalContext> {
        const identity = this.resolveIdentity(args, args.resolvedGame);
        const history = await db.history.where('endTime').below(args.referenceStartTime).toArray();
        const prior = history.filter(record =>
            record.id !== args.currentRecordId &&
            record.startTime < args.referenceStartTime &&
            this.recordsMatchGame(record, identity, args.resolvedGame)
        );
        const lastCompletedAt = prior.reduce<number | undefined>(
            (latest, record) => latest === undefined ? record.endTime : Math.max(latest, record.endTime),
            undefined
        );
        return classifyGameTemporalContext(prior.length, args.referenceStartTime, lastCompletedAt);
    }

    public createRunningState(): GameTemporalRunningState {
        return { completedCount: 0, pending: [], sameStartPending: [] };
    }

    public resolveFromRunningState(state: GameTemporalRunningState, referenceStartTime: number): GameTemporalContext {
        if (state.currentStartTime !== referenceStartTime) {
            state.pending.push(...state.sameStartPending);
            state.sameStartPending = [];
            state.currentStartTime = referenceStartTime;
        }

        const completed = state.pending.filter(item => item.endTime < referenceStartTime);
        state.pending = state.pending.filter(item => item.endTime >= referenceStartTime);
        state.completedCount += completed.length;
        for (const item of completed) {
            state.lastCompletedAt = state.lastCompletedAt === undefined
                ? item.endTime
                : Math.max(state.lastCompletedAt, item.endTime);
        }
        return classifyGameTemporalContext(state.completedCount, referenceStartTime, state.lastCompletedAt);
    }

    public recordCompletion(state: GameTemporalRunningState, record: Pick<HistoryRecord, 'id' | 'endTime'>): void {
        state.sameStartPending.push({ id: record.id, endTime: record.endTime });
    }

    public async resolveBucketEntities(context: GameTemporalContext): Promise<ResolvedEntity[]> {
        const ids = [context.stageBucketId, ...(context.recencyBucketId ? [context.recencyBucketId] : [])];
        const items = await db.savedGameLifecycleContexts.bulkGet(ids);
        return items.filter((item): item is SavedListItem => !!item).map(item => ({
            item,
            table: db.savedGameLifecycleContexts as Table<SavedListItem>,
            type: item.id.startsWith('game_play_stage:') ? 'gamePlayStage' : 'gameRecency',
            isNewContext: true,
            relationTargetScope: [...GAME_LIFECYCLE_RELATION_TARGET_SCOPE],
            relationSourceScope: [...GAME_LIFECYCLE_RELATION_TARGET_SCOPE]
        }));
    }
}

export const gameTemporalContextResolver = new GameTemporalContextResolver();
