
import { GameTemplate, HistoryRecord, ScoreColumn, SavedListItem, BggGame } from '../types';

// ==========================================
// 1. 共通泛型架構 (Common Generic Infrastructure)
// ==========================================

/**
 * [Base Interface] 基礎搜尋索引
 * 透過 TypeScript 的 Template Literal Types 強制規範：
 * 所有搜尋專用的索引欄位，Key 必須以底線 `_` 開頭。
 *這確保了「搜尋資料」與「顯示資料」在命名上的絕對隔離。
 */
export interface BaseSearchIndex {
  [key: `_${string}`]: string;
}

/**
 * [Base Interface] 基礎摘要模型
 * 定義了所有列表項目 (Summary) 的最小公分母。
 * @template TIndex 具體的搜尋索引型別 (必須繼承 BaseSearchIndex)
 */
export interface BaseSummary<TIndex extends BaseSearchIndex> {
  id: string;
  // 這裡雖未列出 TIndex 的具體欄位，但在具體實作時會透過 Intersection Type 合併進來
}

// ==========================================
// 2. 模板具體實作 (Template Implementation)
// ==========================================

/**
 * 模板搜尋索引
 */
export interface TemplateSearchIndex extends BaseSearchIndex {
  _searchName: string;
}

/**
 * 模板摘要 (View Model)
 * 繼承泛型基底 BaseSummary，確保結構一致性。
 */
export interface TemplateSummary extends BaseSummary<TemplateSearchIndex>, TemplateSearchIndex {
  // 顯示資料
  name: string;
  bggId?: string; // [Fix] Added for aggregator merging logic
  
  // [Sync Check]
  updatedAt?: number;
  lastSyncedAt?: number;
  
  // [UI State]
  // isPinned Removed: Pin status is maintained externally by pinnedIds list
  hasImage?: boolean;
  
  // [Icons]
  imageId?: string;
  cloudImageId?: string;
  isLocalImageAvailable: boolean; // Computed (UI Helper) [Renamed to avoid index signature conflict]
  
  // [Logic]
  sourceTemplateId?: string;
  
  // [UX]
  lastPlayerCount?: number;
  defaultScoringRule?: any;
  
  // [Optimization]
  globalVisuals?: any; 
  columns: ScoreColumn[]; 
}

// ==========================================
// 3. 歷史紀錄具體實作 (History Implementation)
// ==========================================

/**
 * 歷史紀錄搜尋索引
 */
export interface HistorySearchIndex extends BaseSearchIndex {
  _playerNames: string;
  _dateStr: string;      // YYYY/MM/DD
  _compactDate: string;  // YYMMDD
  _rocDate: string;      // 民國年
}

/**
 * 歷史紀錄摘要 (View Model)
 * 使用 Type Alias 組合：基底結構 + 搜尋索引 + 原始資料的子集(Partial)
 */
export type HistorySummary = BaseSummary<HistorySearchIndex> & HistorySearchIndex & Partial<HistoryRecord>;

// ==========================================
// 4. 儲存遊戲具體實作 (SavedGame Implementation)
// ==========================================

/**
 * 儲存遊戲搜尋索引
 */
export interface SavedGameSearchIndex extends BaseSearchIndex {
  _searchName: string;
  _bggId: string;
}

/**
 * 儲存遊戲摘要 (View Model)
 */
export type SavedGameSummary = BaseSummary<SavedGameSearchIndex> & SavedGameSearchIndex & {
  name: string;
  lastUsed: number;
  usageCount: number;
  bggId?: string;
  bgStatsId?: string;
}

// ==========================================
// 5. BGG 遊戲具體實作 (BggGame Implementation)
// ==========================================

/**
 * BGG 搜尋索引
 */
export interface BggGameSearchIndex extends BaseSearchIndex {
  _searchName: string;
  _altNames: string; // 扁平化的別名搜尋字串
}

/**
 * BGG 遊戲摘要 (View Model)
 * 只保留用於顯示列表與建立新遊戲時所需的欄位
 */
export type BggGameSummary = BaseSummary<BggGameSearchIndex> & BggGameSearchIndex & {
  name: string;
  altNames: string[]; // 保留陣列結構以供邏輯比對 (如 Aggregator)
  year?: number;      // 用於顯示年份以區分同名遊戲
  
  // Smart Defaults & Metadata
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  complexity?: number;
  bestPlayers?: number[];
}


// ==========================================
// 6. 轉換函式 (Transform Functions)
// ==========================================

/**
 * 擷取計分板摘要
 */
export const extractTemplateSummary = (
  template: GameTemplate,
  availableImageIds: Set<string>
): TemplateSummary => {
  // 1. 建立搜尋索引
  const searchName = template.name;

  // 2. 顯式投影 (Explicit Projection)
  const summary: TemplateSummary = {
    id: template.id,
    name: template.name,
    bggId: template.bggId, // [Fix] Map bggId
    
    updatedAt: template.updatedAt,
    lastSyncedAt: template.lastSyncedAt,
    
    // isPinned removed
    hasImage: template.hasImage,
    imageId: template.imageId,
    cloudImageId: template.cloudImageId,
    sourceTemplateId: template.sourceTemplateId,
    
    lastPlayerCount: template.lastPlayerCount,
    defaultScoringRule: template.defaultScoringRule,
    
    globalVisuals: template.globalVisuals ? {} : undefined,
    
    // [Memory Optimization] 
    // 列表顯示不需要詳細欄位資料，清空以節省記憶體。
    columns: [], 

    isLocalImageAvailable: template.imageId ? availableImageIds.has(template.imageId) : false,
    _searchName: searchName
  };

  return summary;
};

/**
 * 擷取歷史紀錄摘要
 */
export const extractHistorySummary = (
  record: HistoryRecord
): HistorySummary => {
    const d = new Date(record.endTime);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    // 1. 搜尋索引
    const dateStr = `${y}/${m}/${dd}`;
    const compactDateStr = `${String(y).slice(-2)}${m}${dd}`;
    const rocYear = y - 1911;
    const rocDateStr = rocYear > 0 ? `${rocYear}${m}${dd}` : '';
    const playerNames = record.players.map(p => p.name).join(' ');

    // 2. 輕量化玩家
    const lightweightPlayers = record.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        totalScore: p.totalScore,
        linkedPlayerId: p.linkedPlayerId,
        scores: {} 
    }));

    // 3. 組裝摘要
    const summary: HistorySummary = {
        id: record.id,
        gameName: record.gameName,
        endTime: record.endTime,
        location: record.location,
        winnerIds: record.winnerIds,
        
        players: lightweightPlayers as any,
        
        // Search Index
        _playerNames: playerNames,
        _dateStr: dateStr,
        _compactDate: compactDateStr,
        _rocDate: rocDateStr,
        
        snapshotTemplate: undefined,
    };

    return summary;
};

/**
 * 擷取儲存遊戲摘要
 */
export const extractSavedGameSummary = (
  item: SavedListItem
): SavedGameSummary => {
  // 1. 建立搜尋索引
  const searchName = item.name;
  const bggId = item.bggId || '';

  // 2. 顯式投影
  const summary: SavedGameSummary = {
    id: item.id,
    name: item.name,
    lastUsed: item.lastUsed,
    usageCount: item.usageCount,
    bggId: item.bggId,
    bgStatsId: item.bgStatsId,
    
    _searchName: searchName,
    _bggId: bggId
  };

  return summary;
};

/**
 * 擷取 BGG 遊戲摘要
 */
export const extractBggGameSummary = (
  game: BggGame
): BggGameSummary => {
  // 1. 建立搜尋索引
  const searchName = game.name;
  // 將別名陣列轉換為單一字串，方便 Fuse.js 搜尋
  const altNamesStr = (game.altNames || []).join(' ');

  // 2. 顯式投影
  const summary: BggGameSummary = {
    id: game.id,
    name: game.name,
    altNames: game.altNames || [],
    year: game.year,
    
    // 智慧預設值資料
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    playingTime: game.playingTime,
    complexity: game.complexity,
    bestPlayers: game.bestPlayers,

    _searchName: searchName,
    _altNames: altNamesStr
  };

  return summary;
};
