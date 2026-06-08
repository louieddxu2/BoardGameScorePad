import { Candidate, SelectorPlayer } from './types';
import { OptionState } from './selectorEngineTypes';

export const getFourCandidatesForTouch = (
    currentCandidates: Candidate[],
    options: OptionState[],
    players: SelectorPlayer[],
    randomNames: string[],
    createFallbackId: (name: string) => string,
    createTempId: (index: number) => string,
    skippedNames: string[] = []
): Candidate[] => {
    const usedNamesInPlayers = new Set(players.map(player => player.text));
    const skippedSet = new Set(skippedNames);

    // 一開始就強排除：已選玩家與此位置被跳過的玩家
    const baseCandidates = currentCandidates.filter(
        candidate => !usedNamesInPlayers.has(candidate.name) && !skippedSet.has(candidate.name)
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

    // 若仍不足 4 人，從隨機備用人名中補足（同樣排除強排除集合與已加入者）
    let nameIndex = 0;
    while (result.length < 4 && nameIndex < randomNames.length) {
        const fallbackName = randomNames[nameIndex++];
        if (
            !usedNamesInPlayers.has(fallbackName) &&
            !skippedSet.has(fallbackName) &&
            !result.some(item => item.name === fallbackName)
        ) {
            result.push({
                id: createFallbackId(fallbackName),
                name: fallbackName
            });
        }
    }

    // 若仍不足 4 人，使用臨時 Player X 補足
    let tempIdx = 1;
    while (result.length < 4) {
        result.push({
            id: createTempId(tempIdx),
            name: `Player ${tempIdx + 1}`
        });
        tempIdx += 1;
    }

    return result.slice(0, 4);
};
