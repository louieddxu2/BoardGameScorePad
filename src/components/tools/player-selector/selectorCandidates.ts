import { Candidate, SelectorPlayer } from './types';
import { OptionState } from './selectorEngineTypes';
import { Player } from '../../../types';

const normalizeCandidateName = (name: string): string => name.trim().normalize('NFKC').toLowerCase();

export const getManualSessionPlayerCandidates = (players: Player[]): Candidate[] => players
    .filter(player => player.isIdentityManuallySet && player.name.trim().length > 0)
    .map(player => ({
        id: player.linkedPlayerId || `session-player:${player.id}`,
        name: player.name.trim(),
        linkedPlayerId: player.linkedPlayerId
    }));

export const prioritizePlayerCandidates = (
    preferredCandidates: Candidate[],
    recommendedCandidates: Candidate[]
): Candidate[] => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    return [...preferredCandidates, ...recommendedCandidates].filter(candidate => {
        const identityId = candidate.linkedPlayerId || candidate.id;
        const normalizedName = normalizeCandidateName(candidate.name);
        if (seenIds.has(identityId) || seenNames.has(normalizedName)) return false;

        seenIds.add(identityId);
        seenNames.add(normalizedName);
        return true;
    });
};

export const getPlayerCandidateLocks = (
    manualCandidates: Candidate[],
    selectedPlayers: SelectorPlayer[]
): { lockedPlayerIds: string[]; lockedNames: string[] } => ({
    lockedPlayerIds: Array.from(new Set([
        ...manualCandidates.map(candidate => candidate.linkedPlayerId),
        ...selectedPlayers.map(player => player.linkedPlayerId)
    ].filter((id): id is string => !!id))),
    lockedNames: Array.from(new Set([
        ...manualCandidates.map(candidate => candidate.name),
        ...selectedPlayers.map(player => player.text)
    ]))
});

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

    const result: Candidate[] = [...baseCandidates];

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
