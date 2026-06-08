import { Candidate, SelectorPlayer } from './types';
import { OptionState } from './selectorEngineTypes';

export const getFourCandidatesForTouch = (
    currentCandidates: Candidate[],
    options: OptionState[],
    players: SelectorPlayer[],
    randomNames: string[],
    createFallbackId: (name: string) => string,
    createTempId: (index: number) => string,
    skippedIds: string[] = []
): Candidate[] => {
    const usedNamesInPlayers = new Set(players.map(player => player.text));
    const skippedSet = new Set(skippedIds);

    // 一開始就強排除：已選玩家的名字與此位置被跳過的玩家 id
    const baseCandidates = currentCandidates.filter(
        candidate => !usedNamesInPlayers.has(candidate.name) && !skippedSet.has(candidate.id)
    );

    const usedNamesInOptions = new Set(options.map(option => option.text));

    // 優先選用：未在畫面其他氣泡上顯示的名字
    const available = baseCandidates.filter(c => !usedNamesInOptions.has(c.name));
    const result: Candidate[] = [...available];

    // 若不足 4 人，則從「已被其他氣泡顯示」的名字中補足
    if (result.length < 4) {
        const rest = baseCandidates.filter(
            c => usedNamesInOptions.has(c.name) && !result.some(item => item.name === c.name)
        );
        for (const candidate of rest) {
            if (result.length >= 4) break;
            result.push(candidate);
        }
    }

    // 若仍不足 4 人，從隨機備用人名中補足（同樣排除已選玩家與已跳過 ID）
    let nameIndex = 0;
    while (result.length < 4 && nameIndex < randomNames.length) {
        const fallbackName = randomNames[nameIndex++];
        const fallbackId = createFallbackId(fallbackName);
        if (
            !usedNamesInPlayers.has(fallbackName) &&
            !skippedSet.has(fallbackId) &&
            !result.some(item => item.name === fallbackName)
        ) {
            result.push({
                id: fallbackId,
                name: fallbackName
            });
        }
    }

    // 若仍不足 4 人，使用臨時 Player X 補足
    let tempIdx = 1;
    while (result.length < 4) {
        const tempId = createTempId(tempIdx);
        if (!skippedSet.has(tempId)) {
            result.push({
                id: tempId,
                name: `Player ${tempIdx + 1}`
            });
        }
        tempIdx += 1;
    }

    return result.slice(0, 4);
};
