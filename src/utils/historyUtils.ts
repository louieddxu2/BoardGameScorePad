import { HistoryRecord, ScoringRule, GameTemplate } from '../types';

/**
 * 安全獲取歷史紀錄的計分規則 (Scoring Rule)
 * 優先讀取頂層 scoringRule，若無則回退至快照中的 defaultScoringRule，最後預設為 HIGHEST_WINS。
 * 這確保了 UI 端不需要重複編寫 `|| 'HIGHEST_WINS'` 的預設邏輯。
 */
export const getRecordScoringRule = (record: HistoryRecord): ScoringRule => {
  return record.scoringRule ?? record.snapshotTemplate?.defaultScoringRule ?? 'HIGHEST_WINS';
};

/**
 * 安全獲取歷史紀錄的 BGG ID
 * 優先讀取頂層 bggId，若無則回退至快照中的 bggId。
 */
export const getRecordBggId = (record: HistoryRecord): string | undefined => {
  return record.bggId ?? record.snapshotTemplate?.bggId;
};

/**
 * 安全獲取歷史紀錄的遊戲名稱
 * 目前僅讀取頂層 gameName，保留此函式以統一介面。
 */
export const getRecordGameName = (record: HistoryRecord): string => {
  return record.gameName;
};

/**
 * 安全獲取歷史紀錄的計分板模板 (Template Snapshot)
 * 
 * 策略：
 * 1. 只要 snapshotTemplate 存在且不是空陣列 [] (簡易模式的標記)，就直接信任並使用。
 *    不再檢查 columns 結構或數量，確保能還原任何形式的歷史快照。
 * 2. 若為空陣列或不存在，則動態產生一個「虛擬模板」以供 UI 顯示。
 */
export const getRecordTemplate = (record: HistoryRecord): GameTemplate => {
  const snapshot = record.snapshotTemplate as any;
  
  // 檢查：存在 AND (不是陣列 OR 陣列長度不為0)
  // 這會排除 null, undefined, 以及 []
  if (snapshot && !(Array.isArray(snapshot) && snapshot.length === 0)) {
    return snapshot as GameTemplate;
  }

  // 建構虛擬模板 (Virtual Template)
  // 對應 "簡易模式" (Simple Mode) 或 資料遺失的情況
  return {
    id: record.templateId,
    name: record.gameName,
    columns: [], // 無欄位，UI 會自動顯示為簡易模式
    bggId: getRecordBggId(record) || '',
    createdAt: record.startTime,
    updatedAt: record.updatedAt || record.endTime,
    lastPlayerCount: record.players.length,
    defaultScoringRule: getRecordScoringRule(record),
    hasImage: false,
    description: "Generated from history record"
  };
};
