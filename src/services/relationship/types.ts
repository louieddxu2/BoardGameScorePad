
import { Table } from 'dexie';
import { SavedListItem } from '../../types';

export type EntityType = 'player' | 'game' | 'location' | 'weekday' | 'timeslot' | 'playerCount' | 'gameMode' | 'sessionContext' | 'color';

export interface RelationItem {
    id: string;
    count: number;
}

export interface ResolvedEntity {
    item: SavedListItem;
    table: Table<SavedListItem>;
    type: EntityType;
    isNewContext: boolean; // 是否為本次「新出現」的情境 (例如新地點、新遊戲)，若是，則需要更新其關聯
}
