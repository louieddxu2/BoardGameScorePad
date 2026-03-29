
import { HistoryRecord, ScoringRule, GameTemplate } from '../types';
import { createVirtualTemplate } from './templateUtils';

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

  // [Fix] 嚴格檢查 snapshot 是否有效。必須存在且具備 columns 屬性。
  // 若 snapshot 只是以前 bug 產生的空物件或空殼，則視為無效，回退至虛擬模板。
  if (snapshot && Array.isArray(snapshot.columns)) {
    // 額外相容處理：舊版簡易模式可能將 snapshot 存為 []
    if (snapshot.columns.length === 0 && Array.isArray(snapshot)) {
       // 跳過，去執行下方的虛擬模板邏輯
    } else {
       return snapshot as GameTemplate;
    }
  }

  // 建構虛擬模板 (Virtual Template)
  return createVirtualTemplate(
    record.templateId,
    record.gameName,
    getRecordBggId(record),
    record.updatedAt || record.endTime,
    record.players.length,
    getRecordScoringRule(record)
  );
};