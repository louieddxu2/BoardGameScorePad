import { useEffect, useRef } from 'react';
import { Candidate, SelectorPlayer, SelectorTurnOrderEntry } from './types';
import { OptionState, SelectorPointerInput, TouchState } from './selectorEngineTypes';
import { getFourCandidatesForTouch } from './selectorCandidates';
import { applyPaletteClick, applyPlayerClick } from './selectorHitTest';
import { createPlayerSelectorPhysicsLoop, DEFAULT_COLOR } from './selectorPhysics';
import { bindPlayerSelectorEvents } from './selectorEvents';
import { closeSelectorPlayerPalettes } from './selectorDisplay';
import { GameTemplate, SavedListItem } from '../../../types';
import { Voter } from '../../../features/recommendation/ContextResolver';


const ANONYMOUS_PLAYER_PREFIX = "玩家"; // 預設玩家

interface UsePlayerSelectorPrototypeRendererProps {
    svgRef: React.RefObject<SVGSVGElement | null>;
    candidates: Candidate[];
    randomNames: string[];
    turnOrder?: SelectorTurnOrderEntry[];
    highlightedPlayerId?: string | null;
    starterPlayerId?: string | null;
    shouldRetreatPlayers?: boolean;
    isInteractionLocked?: boolean;
    expectedPlayerCount?: number;
    template?: GameTemplate;
    allSavedPlayers?: SavedListItem[];
    contextVoters?: Voter[];
    tapToRefreshText?: string;
    onSelectorPlayersChange: (players: SelectorPlayer[]) => void;
    onCandidateLocked: (candidate: Candidate) => void;
}

export const usePlayerSelectorRenderer = ({
    svgRef,
    candidates,
    randomNames,
    turnOrder = [],
    highlightedPlayerId = null,
    starterPlayerId = null,
    shouldRetreatPlayers = false,
    isInteractionLocked = false,
    expectedPlayerCount = 0,
    template,
    allSavedPlayers = [],
    contextVoters = [],
    tapToRefreshText,
    onSelectorPlayersChange,
    onCandidateLocked
}: UsePlayerSelectorPrototypeRendererProps) => {

    const templateRef = useRef(template);
    const allSavedPlayersRef = useRef(allSavedPlayers);
    const contextVotersRef = useRef(contextVoters);

    useEffect(() => {
        templateRef.current = template;
        allSavedPlayersRef.current = allSavedPlayers;
        contextVotersRef.current = contextVoters;
    }, [template, allSavedPlayers, contextVoters]);

    const activeTouchesRef = useRef<Map<string | number, TouchState>>(new Map());
    const optionsRef = useRef<OptionState[]>([]);
    const playersRef = useRef<SelectorPlayer[]>([]);
    const playerVelocitiesRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
    const displayPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const optionIdCounterRef = useRef(0);
    const animationFrameIdRef = useRef<number | null>(null);
    const isRunningRef = useRef(false);
    const resultDisplayRef = useRef({
        turnOrder,
        highlightedPlayerId,
        starterPlayerId,
        shouldRetreatPlayers,
        isInteractionLocked
    });

    const expectedCountRef = useRef(expectedPlayerCount);
    useEffect(() => {
        expectedCountRef.current = expectedPlayerCount;
    }, [expectedPlayerCount]);

    const candidatesRef = useRef<Candidate[]>(candidates);
    useEffect(() => {
        candidatesRef.current = candidates;
    }, [candidates]);

    const lastReleasesRef = useRef<Array<{ x: number; y: number; time: number; ids: string[] }>>([]);

    const callbacksRef = useRef({
        onSelectorPlayersChange,
        onCandidateLocked,
        randomNames
    });
    useEffect(() => {
        callbacksRef.current = {
            onSelectorPlayersChange,
            onCandidateLocked,
            randomNames
        };
    }, [onSelectorPlayersChange, onCandidateLocked, randomNames]);

    const prevWidthRef = useRef<number>(0);
    const prevHeightRef = useRef<number>(0);

    useEffect(() => {
        resultDisplayRef.current = {
            turnOrder,
            highlightedPlayerId,
            starterPlayerId,
            shouldRetreatPlayers,
            isInteractionLocked
        };
    }, [turnOrder, highlightedPlayerId, starterPlayerId, shouldRetreatPlayers, isInteractionLocked]);

    const clearRendererState = () => {
        activeTouchesRef.current.clear();
        optionsRef.current = [];
        playersRef.current = [];
        playerVelocitiesRef.current.clear();
        displayPositionsRef.current.clear();
        optionIdCounterRef.current = 0;
        prevWidthRef.current = 0;
        prevHeightRef.current = 0;

        const svg = svgRef.current;
        if (svg) {
            svg.innerHTML = "";
        }
    };

    const spawnOptionsForTouch = (touchId: string | number, x: number, y: number, skippedIds: string[] = []) => {
        const selectedCandidates = getFourCandidatesForTouch(
            candidatesRef.current,
            optionsRef.current,
            playersRef.current,
            callbacksRef.current.randomNames,
            (name) => `fallback_${name}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            (index) => `temp_${index}_${Date.now()}`,
            skippedIds
        );

        for (let i = 0; i < 4; i++) {
            optionsRef.current.push({
                id: optionIdCounterRef.current++,
                touchId: touchId,
                idx: i,
                x: x,
                y: y,
                vx: 0,
                vy: 0,
                frozenX: null,
                frozenY: null,
                text: selectedCandidates[i].name,
                color: DEFAULT_COLOR,
                candidate: selectedCandidates[i]
            });
        }
    };

    const removeOptionsForTouch = (touchId: string | number) => {
        optionsRef.current = optionsRef.current.filter(o => o.touchId !== touchId);
    };

    const getNextAnonymousPlayerName = () => {
        const usedNumbers = new Set<number>();
        const collectNumber = (name: string) => {
            const match = name.match(/^(?:\u73a9\u5bb6|Player)\s?(\d+)$/);
            if (match) {
                usedNumbers.add(Number(match[1]));
            }
        };

        playersRef.current.forEach(player => collectNumber(player.text));
        optionsRef.current.forEach(option => collectNumber(option.text));

        let index = 1;
        while (usedNumbers.has(index)) index++;
        return `${ANONYMOUS_PLAYER_PREFIX} ${index}`;
    };

    const materializePlayer = (touch: TouchState, option: OptionState, state: 'COLOR_PICKING' | 'READY' = 'READY') => {
        const expected = expectedCountRef.current;
        if (expected > 0 && playersRef.current.length >= expected) {
            return;
        }

        const id = 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        playerVelocitiesRef.current.set(id, { vx: option.vx || 0, vy: option.vy || 0 });

        playersRef.current.push({
            id,
            candidateId: option.candidate.id,
            touchId: touch.id,
            suggestedColors: option.candidate.suggestedColors,
            linkedPlayerId: option.candidate.linkedPlayerId,
            x: option.x,
            y: option.y,
            textRotationDeg: touch.textRotationDeg,
            text: option.text,
            color: option.color,
            isColorManuallySet: false,
            state
        });
        callbacksRef.current.onSelectorPlayersChange([...playersRef.current]);
    };

    const physicsLoop = createPlayerSelectorPhysicsLoop({
        svgRef, activeTouchesRef, optionsRef, playersRef, playerVelocitiesRef, displayPositionsRef,
        optionIdCounterRef, animationFrameIdRef, isRunningRef, resultDisplayRef, allSavedPlayersRef, templateRef,
        contextVotersRef, prevWidthRef, prevHeightRef, callbacksRef,
        materializePlayer, removeOptionsForTouch, getNextAnonymousPlayerName, tapToRefreshText
    });

    const checkColorPaletteClick = (clickX: number, clickY: number): boolean => {
        const svg = svgRef.current;
        if (!svg) return false;

        const rect = svg.getBoundingClientRect();
        const result = applyPaletteClick(
            playersRef.current,
            { x: clickX - rect.left, y: clickY - rect.top },
            displayPositionsRef.current
        );

        if (!result.handled) return false;

        playersRef.current = result.players;
        callbacksRef.current.onSelectorPlayersChange([...playersRef.current]);
        return true;
    };

    const checkPlayerClick = (clickX: number, clickY: number): boolean => {
        const svg = svgRef.current;
        if (!svg) return false;

        const rect = svg.getBoundingClientRect();
        const result = applyPlayerClick(
            playersRef.current,
            { x: clickX - rect.left, y: clickY - rect.top },
            displayPositionsRef.current
        );

        if (!result.handled) return false;

        playersRef.current = result.players;
        callbacksRef.current.onSelectorPlayersChange([...playersRef.current]);
        return true;

    };

    const handleStart = (input: SelectorPointerInput) => {
        const expected = expectedCountRef.current;
        if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
            return;
        }

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const canvasX = input.clientX - rect.left;
        const canvasY = input.clientY - rect.top;

        // 判定是否為 0.5 秒內且 80 像素內同位置的連點
        let skippedIds: string[] = [];
        const now = Date.now();
        const matchIdx = lastReleasesRef.current.findIndex(r => {
            const timeDiff = now - r.time;
            const dx = canvasX - r.x;
            const dy = canvasY - r.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return timeDiff <= 500 && dist <= 80;
        });

        if (matchIdx !== -1) {
            skippedIds = lastReleasesRef.current[matchIdx].ids;
            // 移除該次記錄，避免被其他點按重複消費
            lastReleasesRef.current.splice(matchIdx, 1);
        }

        activeTouchesRef.current.set(input.id, {
            id: input.id,
            startX: canvasX,
            startY: canvasY,
            clientX: input.clientX,
            clientY: input.clientY,
            canvasX: canvasX,
            canvasY: canvasY,
            anchorX: canvasX,
            anchorY: canvasY,
            radiusX: input.contactWidth / 2,
            radiusY: input.contactHeight / 2,
            rotationAngle: input.contactAngle,
            state: 'CHOOSING',
            spawnTime: Date.now(),
            stationaryStartTime: Date.now(),
            selectedOptionId: null,
            selectionStartTime: 0,
            optionsFrozen: false,
            progress: 0,
            forwardAngleRad: 0,
            humanAngleRad: 0,
            textRotationDeg: 0,
            accumulatedSkippedIds: skippedIds
        });

        spawnOptionsForTouch(input.id, canvasX, canvasY, skippedIds);
    };

    const handleMove = (input: SelectorPointerInput) => {
        const touch = activeTouchesRef.current.get(input.id);
        if (!touch) return;

        touch.clientX = input.clientX;
        touch.clientY = input.clientY;
        touch.radiusX = input.contactWidth / 2;
        touch.radiusY = input.contactHeight / 2;
        touch.rotationAngle = input.contactAngle;
    };

    const getTouchInput = (touch: Touch): SelectorPointerInput => ({
        id: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
        contactWidth: (touch.radiusX || 0) * 2,
        contactHeight: (touch.radiusY || 0) * 2,
        contactAngle: touch.rotationAngle || 0,
        source: 'touch'
    });

    const getPointerInput = (event: PointerEvent): SelectorPointerInput => {
        const pointerType = event.pointerType || 'mouse';
        const isContactPointer = pointerType === 'touch' || pointerType === 'pen';

        return {
            id: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            contactWidth: isContactPointer ? event.width || 0 : 0,
            contactHeight: isContactPointer ? event.height || 0 : 0,
            contactAngle: 0,
            source: 'pointer',
            pointerType
        };
    };

    const handleEnd = (id: string | number) => {
        const touch = activeTouchesRef.current.get(id);
        if (!touch) return;

        if (touch.state === 'LOCKED') {
            // 手指放開時，解綁該玩家的 touchId，結束物理跟手跟排斥更新，防範 touchId 被重用衝突
            const targetPlayer = playersRef.current.find(p => p.touchId === id);
            if (targetPlayer) {
                targetPlayer.touchId = undefined;
                callbacksRef.current.onSelectorPlayersChange([...playersRef.current]);
            }
        } else {
            // 手指放開且未鎖定，記錄為被跳過的氣泡
            const currentOptIds = optionsRef.current
                .filter(o => o.touchId === id)
                .map(o => o.candidate.id);
            if (currentOptIds.length > 0) {
                const newSkippedIds = Array.from(new Set([
                    ...(touch.accumulatedSkippedIds || []),
                    ...currentOptIds
                ]));
                lastReleasesRef.current.push({
                    x: touch.canvasX,
                    y: touch.canvasY,
                    time: Date.now(),
                    ids: newSkippedIds
                });
                // 只保留最近 5 筆記錄，防止洩漏
                if (lastReleasesRef.current.length > 5) {
                    lastReleasesRef.current.shift();
                }
            }
        }
        activeTouchesRef.current.delete(id);
        removeOptionsForTouch(id);
    };

    const closeAllPalettes = () => {
        const nextPlayers = closeSelectorPlayerPalettes(playersRef.current);
        playersRef.current = nextPlayers;
        callbacksRef.current.onSelectorPlayersChange([...playersRef.current]);
    };

    const resetEngine = () => {
        clearRendererState();
        onSelectorPlayersChange([]);
    };

    useEffect(() => bindPlayerSelectorEvents({
        svgRef, activeTouchesRef, playersRef, resultDisplayRef, isRunningRef, animationFrameIdRef, callbacksRef,
        expectedCountRef, physicsLoop, checkColorPaletteClick, checkPlayerClick, handleStart, handleMove,
        handleEnd, getTouchInput, getPointerInput, clearRendererState
    }), []);

    return {
        resetEngine,
        closeAllPalettes
    };
};


