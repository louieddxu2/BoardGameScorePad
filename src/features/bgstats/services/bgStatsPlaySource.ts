import type { HistoryRecord } from '../../../types';

type RawFields = Record<string, unknown>;

/**
 * 匯入時保存的 BG Stats 原始對局資料，讓匯出時能還原 ScorePad 沒有使用的欄位。
 * 整數參照（gameRefId、locationRefId、playerRefId）只在單一檔案內有效，不保存。
 */
export interface BgStatsPlaySource {
    /** 匯入當下 ScorePad 管理欄位的指紋；與目前紀錄相同代表這局沒有在 ScorePad 被修改。 */
    fingerprint: string;
    /** 原始對局欄位（不含 playerScores 與整數參照）。 */
    play: RawFields;
    /** 依座位順序保存的原始玩家分數欄位（不含 playerRefId）。 */
    playerScores: RawFields[];
    /** 匯入當下每個座位的玩家身分，用來判斷修改後的對局中，原始欄位還屬不屬於同一位玩家。 */
    playerKeys: string[];
}

const PLAY_REFS = ['playerScores', 'gameRefId', 'locationRefId'];

const omit = (source: RawFields, keys: string[]): RawFields => {
    const copy: RawFields = { ...source };
    keys.forEach(key => delete copy[key]);
    return copy;
};

export const historyPlayerKey = (player: HistoryRecord['players'][number]): string =>
    JSON.stringify([player.linkedPlayerId ?? '', player.name]);

/** ScorePad 會修改、也會匯出的欄位。其他欄位（顏色、照片、雲端資訊）不影響匯出內容。 */
export const historyFingerprint = (record: HistoryRecord): string => JSON.stringify([
    record.startTime,
    record.endTime,
    record.note ?? '',
    record.locationId ?? '',
    record.location ?? '',
    record.scoringRule ?? '',
    [...record.winnerIds].sort(),
    record.players.map(player => [historyPlayerKey(player), player.totalScore, !!player.isStarter]),
]);

export const captureBgStatsSource = (play: RawFields, record: HistoryRecord): BgStatsPlaySource => ({
    fingerprint: historyFingerprint(record),
    play: omit(play, PLAY_REFS),
    playerScores: (Array.isArray(play.playerScores) ? play.playerScores as RawFields[] : [])
        .map(score => omit(score, ['playerRefId'])),
    playerKeys: record.players.map(historyPlayerKey),
});

/**
 * 以保存的原始資料組回匯出的對局。
 * - 沒被修改的對局：原始欄位原樣輸出，只換上本檔的整數參照。
 * - 修改過的對局：保留原始欄位，再以 ScorePad 的資料（managed）覆蓋；
 *   同一座位仍是同一位玩家時保留該玩家的原始欄位，分數沒變時保留原始分數文字。
 */
export const restoreBgStatsPlay = (
    record: HistoryRecord,
    managedPlay: RawFields,
    placeholderPlay: RawFields,
    managedScores: RawFields[],
    placeholderScores: RawFields[],
): RawFields => {
    const source = record.bgStatsSource;
    if (!source) return { ...placeholderPlay, ...managedPlay, playerScores: managedScores.map((row, i) => ({ ...placeholderScores[i], ...row })) };

    const refs = { uuid: managedPlay.uuid, gameRefId: managedPlay.gameRefId, locationRefId: managedPlay.locationRefId };
    if (historyFingerprint(record) === source.fingerprint && source.playerScores.length === managedScores.length) {
        return {
            ...source.play,
            ...refs,
            playerScores: source.playerScores.map((row, i) => ({ ...row, playerRefId: managedScores[i].playerRefId })),
        };
    }

    const playerScores = managedScores.map((row, i) => {
        const player = record.players[i];
        const sameSeat = player && source.playerKeys[i] === historyPlayerKey(player);
        const original = sameSeat ? source.playerScores[i] : undefined;
        const merged: RawFields = { ...placeholderScores[i], ...original, ...row };
        if (original && typeof original.score === 'string' && Number(original.score || 0) === player.totalScore) {
            merged.score = original.score;
        }
        return merged;
    });
    return { ...placeholderPlay, ...source.play, ...managedPlay, playerScores };
};
