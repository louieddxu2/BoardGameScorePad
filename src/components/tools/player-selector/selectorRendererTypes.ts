import type { MutableRefObject, RefObject } from 'react';
import type { GameTemplate, SavedListItem } from '../../../types';
import type { Voter } from '../../../features/recommendation/ContextResolver';
import type { Candidate, SelectorPlayer, SelectorTurnOrderEntry } from './types';
import type { OptionState, TouchState } from './selectorEngineTypes';

export interface PlayerSelectorPhysicsOptions {
    svgRef: RefObject<SVGSVGElement | null>;
    activeTouchesRef: MutableRefObject<Map<string | number, TouchState>>;
    optionsRef: MutableRefObject<OptionState[]>;
    playersRef: MutableRefObject<SelectorPlayer[]>;
    playerVelocitiesRef: MutableRefObject<Map<string, { vx: number; vy: number }>>;
    displayPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
    optionIdCounterRef: MutableRefObject<number>;
    animationFrameIdRef: MutableRefObject<number | null>;
    isRunningRef: MutableRefObject<boolean>;
    resultDisplayRef: MutableRefObject<{
        turnOrder: SelectorTurnOrderEntry[];
        highlightedPlayerId: string | null;
        starterPlayerId: string | null;
        shouldRetreatPlayers: boolean;
        isInteractionLocked: boolean;
    }>;
    allSavedPlayersRef: MutableRefObject<SavedListItem[]>;
    templateRef: MutableRefObject<GameTemplate | undefined>;
    contextVotersRef: MutableRefObject<Voter[]>;
    prevWidthRef: MutableRefObject<number>;
    prevHeightRef: MutableRefObject<number>;
    callbacksRef: MutableRefObject<{
        onSelectorPlayersChange: (players: SelectorPlayer[]) => void;
        onCandidateLocked: (candidate: Candidate) => void;
        randomNames: string[];
    }>;
    materializePlayer: (touch: TouchState, option: OptionState, state?: 'COLOR_PICKING' | 'READY') => void;
    removeOptionsForTouch: (touchId: string | number) => void;
    getNextAnonymousPlayerName: () => string;
    tapToRefreshText?: string;
}
