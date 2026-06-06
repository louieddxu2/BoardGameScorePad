import { Candidate, PrototypePlayer } from './types';
import { OptionState } from './prototypeEngineTypes';

export const getFourCandidatesForTouch = (
    currentCandidates: Candidate[],
    options: OptionState[],
    players: PrototypePlayer[],
    randomNames: string[],
    createFallbackId: (name: string) => string,
    createTempId: (index: number) => string
): Candidate[] => {
    const usedNamesInOptions = new Set(options.map(option => option.text));
    const usedNamesInPlayers = new Set(players.map(player => player.text));

    const available = currentCandidates.filter(
        candidate => !usedNamesInOptions.has(candidate.name) && !usedNamesInPlayers.has(candidate.name)
    );

    const result: Candidate[] = [...available];

    if (result.length < 4) {
        const restCandidates = currentCandidates.filter(
            candidate => !usedNamesInPlayers.has(candidate.name) && !result.some(item => item.name === candidate.name)
        );
        for (const candidate of restCandidates) {
            if (result.length >= 4) break;
            result.push(candidate);
        }
    }

    let nameIndex = 0;
    while (result.length < 4 && nameIndex < randomNames.length) {
        const fallbackName = randomNames[nameIndex++];
        if (
            !usedNamesInOptions.has(fallbackName) &&
            !usedNamesInPlayers.has(fallbackName) &&
            !result.some(item => item.name === fallbackName)
        ) {
            result.push({
                id: createFallbackId(fallbackName),
                name: fallbackName
            });
        }
    }

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
