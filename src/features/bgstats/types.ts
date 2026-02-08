
import { SavedListItem } from '../../types';

// 對應 BG Stats 匯出的 JSON 結構
export interface BgStatsExport {
  games?: BgStatsGame[];
  players?: BgStatsPlayer[];
  locations?: BgStatsLocation[];
  plays?: any[]; 
  userInfo?: any;
  [key: string]: any; 
}

export interface BgStatsGame {
  uuid: string; // BGStats 內部 UUID
  id: number;   // BGStats 內部整數 ID
  name: string;
  bggId?: number; // BoardGameGeek ID
  bggName?: string;
  bggYear?: number;
  designers?: string;
  publisher?: string;
  image?: string;     
  thumbnail?: string;
  urlImage?: string;  
  urlThumb?: string;  
  modificationDate?: string; 
  cooperative?: boolean;
  highestWins?: boolean; // ExportService 使用
  noPoints?: boolean;    // ExportService 使用
  isBaseGame?: number;   // ExportService 使用
  isExpansion?: number;  // ExportService 使用
  rating?: number;       // ExportService 使用
  usesTeams?: boolean;   // ExportService 使用
  [key: string]: any; 
}

export interface BgStatsPlayer {
  uuid: string;
  id: number;
  name: string;
  isAnonymous?: boolean;
  modificationDate?: string;
  bggUsername?: string;
  [key: string]: any; 
}

export interface BgStatsLocation {
  uuid: string;
  id: number;
  name: string;
  modificationDate?: string;
  [key: string]: any; 
}

// 分析報告結構
export interface ImportCategoryData {
  localUnmatched: SavedListItem[]; // 本地端尚未連線且名稱未自動配對到的
  importUnmatched: (BgStatsGame | BgStatsPlayer | BgStatsLocation)[]; // 匯入端未自動配對到的
  matchedCount: number; // 自動配對成功的數量
}

export interface ImportAnalysisReport {
  games: ImportCategoryData;
  players: ImportCategoryData;
  locations: ImportCategoryData;
  sourceData: BgStatsExport; // 保留原始資料以供後續步驟使用
}

// 手動連線定義
export interface ManualLink {
  targetId: string;        // 本地端的 UUID (SavedGame ID 或 Template ID)
  type: 'game' | 'template' | 'player' | 'location';
}

// [New] 整合傳遞用的連結包，避免 ID 衝突
export interface ImportManualLinks {
  games: Map<number, ManualLink>;
  players: Map<number, ManualLink>;
  locations: Map<number, ManualLink>;
}
