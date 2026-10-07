import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn, SavedListItem } from '../../../types';
import { useSessionState } from '../hooks/useSessionState';
import { useSessionEvents } from '../hooks/useSessionEvents';
import NumericKeypad from '../../shared/NumericKeypad';
import PlayerEditor, { PlayerSettingsPanel } from './PlayerEditor';
import InputPanelHeader from './InputPanelHeader';
import TotalAdjustmentSidebar from './TotalAdjustmentSidebar';
import { buildColumnInputView } from './buildColumnInputView';
import InputPanelLayout from './InputPanelLayout';
import SmartSpacer from './SmartSpacer';
import { Check } from 'lucide-react';
import { getScoreHistory, getRawValue } from '../../../utils/scoring';
import { useSessionTranslation } from '../../../i18n/session';
import { colorRecommendationEngine } from '../../../features/recommendation/ColorRecommendationEngine';
import { applyScoreInputValue } from '../scoreInputUpdate';
import { getInitialScoreInputPreviewValue } from '../scoreInputPreview';
import { touchGestureGuard } from '../../../utils/touchGesture';

interface InputPanelProps {
    sessionState: ReturnType<typeof useSessionState>;
    eventHandlers: ReturnType<typeof useSessionEvents>;
    session: GameSession;
    template: GameTemplate;
    savedPlayers: SavedListItem[]; // Renamed from playerHistory
    allSavedPlayers?: SavedListItem[];
    onUpdateSession: (session: GameSession) => void;
    onUpdateSavedPlayer: (name: string) => void; // Renamed from onUpdatePlayerHistory
    // [New Props for SmartSpacer]
    onTakePhoto?: () => void;
    onScreenshotRequest?: (mode: 'full' | 'simple') => void;
    isVoiceEnabled?: boolean;
    onToggleVoice?: () => void;
    bottomOffset: string;
    canEditScore?: (playerId: string, column: ScoreColumn | undefined) => boolean;
    canEditTotal?: (playerId: string) => boolean;
    canEditPlayers?: boolean;
    mediaOnlyTools?: boolean;
    onToolboxInputFocusChange?: (focused: boolean) => void;
    toolboxTopContent?: React.ReactNode;
}

const InputPanel: React.FC<InputPanelProps> = (props) => {
    const { sessionState, eventHandlers, session, template, savedPlayers, allSavedPlayers, onUpdateSession, onUpdateSavedPlayer, onTakePhoto, onScreenshotRequest, isVoiceEnabled, onToggleVoice, bottomOffset, canEditScore = () => true, canEditTotal = () => true, canEditPlayers = true, mediaOnlyTools = false, onToolboxInputFocusChange, toolboxTopContent } = props;
    const { uiState, setUiState, panelHeight, isShortList } = sessionState;
    const { editingCell, editingPlayerId, advanceDirection, overwriteMode, isInputFocused, previewValue, isEditingTitle, isToolboxOpen } = uiState;
    const { t } = useSessionTranslation();
    const [activeFactorIdx, setActiveFactorIdx] = useState<0 | 1>(0);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [recommendedColors, setRecommendedColors] = useState<string[]>([]);

    const editingPlayer = session.players.find(p => p.id === editingPlayerId);
    const currentName = editingPlayer?.name;
    const currentLinkedId = editingPlayer?.linkedPlayerId;

    useEffect(() => {
        if (!editingPlayerId || !editingPlayer) {
            setRecommendedColors([]);
            return;
        }

        const fetchRecommendedColors = async () => {
            try {
                const targetPlayerId = currentLinkedId || editingPlayer.id;

                const suggestions = await colorRecommendationEngine.generateSuggestions(
                    { gameName: session.name },
                    template,
                    targetPlayerId
                );
                setRecommendedColors(suggestions);
            } catch (error) {
                console.error("[InputPanel] Failed to fetch recommended colors:", error);
                setRecommendedColors([]);
            }
        };

        fetchRecommendedColors();
    }, [editingPlayerId, currentName, currentLinkedId, session.name, template]);

    // Guard Ref to prevent re-initialization of preview value on every render
    const currentEditingIdRef = useRef<string | null>(null);

    // --- Swipe Hint Detection Refs ---
    const swipeTriggerRef = useRef(false); // Set true when joystick swipe triggers player switch
    const hintShownRef = useRef(false); // Track if hint already shown this session
    const sameColSwitchTimestampsRef = useRef<number[]>([]);
    const prevEditingCellRef = useRef(editingCell);

    // Initialize preview value based on column type when cell changes
    useLayoutEffect(() => {
        // Construct a unique key for the current cell
        const targetId = editingCell ? `${editingCell.playerId}-${editingCell.colId}` : null;

        // Only update preview if we actually switched to a DIFFERENT cell
        if (targetId !== currentEditingIdRef.current) {
            currentEditingIdRef.current = targetId;

            // [Fix] Reset active factor ONLY when switching cells, not on every render
            setActiveFactorIdx(0);

            if (editingCell) {
                setUiState((p: any) => ({
                    ...p,
                    previewValue: getInitialScoreInputPreviewValue(session, template, editingCell),
                }));
            }
        }
    }, [editingCell, template.columns, setUiState, session.players]);

    // --- Swipe Hint Detection ---
    useEffect(() => {
        const prev = prevEditingCellRef.current;
        prevEditingCellRef.current = editingCell;

        // Skip if hint already shown this session
        if (hintShownRef.current) return;

        // Only track cell-to-cell transitions (not null -> cell or cell -> null)
        if (!prev || !editingCell) return;

        // Detect: same column, different player, NOT triggered by swipe gesture
        if (prev.colId === editingCell.colId && prev.playerId !== editingCell.playerId) {
            if (swipeTriggerRef.current) {
                // This switch was triggered by swipe — just reset the flag, don't count it
                swipeTriggerRef.current = false;
                return;
            }

            const now = Date.now();
            sameColSwitchTimestampsRef.current.push(now);

            // Keep only timestamps within the last 10 seconds
            sameColSwitchTimestampsRef.current = sameColSwitchTimestampsRef.current.filter(
                ts => now - ts <= 10000
            );

            // Trigger hint after 2 same-column switches within 10 seconds
            if (sameColSwitchTimestampsRef.current.length >= 2) {
                hintShownRef.current = true;
                setShowSwipeHint(true);

                // Auto-dismiss after 4 seconds
                setTimeout(() => setShowSwipeHint(false), 4000);
            }
        } else {
            // Reset swipe flag on any non-same-column transition
            swipeTriggerRef.current = false;
        }
    }, [editingCell]);

    const isPanelOpen = editingCell !== null || editingPlayerId !== null;

    const updateScore = (playerId: string, colId: string, value: any) => {
        const column = template.columns.find(candidate => candidate.id === colId);
        if (!column || !canEditScore(playerId, column)) return;
        onUpdateSession(applyScoreInputValue(session, column, playerId, value));
    };

    const updatePlayerMeta = (playerId: string, updates: Partial<Player>) => {
        const isOwnTotalAdjustment = editingCell?.colId === '__TOTAL__' && canEditTotal(playerId);
        if (!canEditPlayers && !isOwnTotalAdjustment) return;
        const players = session.players.map(p => p.id === playerId ? { ...p, ...updates } : p);
        onUpdateSession({ ...session, players });
    };

    const handleToggleStarter = (playerId: string) => {
        if (!canEditPlayers) return;
        const targetPlayer = session.players.find(p => p.id === playerId);
        const isCurrentlyStarter = !!targetPlayer?.isStarter;

        const newPlayers = session.players.map(p => ({
            ...p,
            isStarter: p.id === playerId ? !isCurrentlyStarter : false
        }));
        onUpdateSession({ ...session, players: newPlayers });
    };

    const setPreview = (val: any) => {
        setUiState((p: any) => ({ ...p, previewValue: val }));
    };

    const handleDirectionToggle = () => {
        setUiState((p: any) => {
            const newDir = p.advanceDirection === 'horizontal' ? 'vertical' : 'horizontal';
            // Persist preference
            localStorage.setItem('sm_pref_advance_direction', newDir);
            return { ...p, advanceDirection: newDir };
        });
    };

    const handleClear = () => {
        if (editingPlayerId) {
            setUiState((p: any) => ({ ...p, tempPlayerName: '' }));
            updatePlayerMeta(editingPlayerId, { name: '' });
        } else if (editingCell) {
            const player = session.players.find((p: any) => p.id === editingCell.playerId);

            if (editingCell.colId === '__TOTAL__') {
                if (player) {
                    const baseScore = player.totalScore - (player.bonusScore || 0);
                    updatePlayerMeta(player.id, { bonusScore: 0 });
                    setPreview(baseScore);
                    setUiState((p: any) => ({ ...p, overwriteMode: true }));
                }
                return;
            }

            const col = template.columns.find((c: any) => c.id === editingCell.colId);
            if (player && col && col.inputType !== 'auto') {
                if ((col.formula || '').includes('+next')) {
                    if (col.formula.includes('×a2')) {
                        setPreview({ factors: [0, 1] });
                        setActiveFactorIdx(0);
                    } else {
                        setPreview(0);
                    }
                } else if (col.formula === 'a1×a2') {
                    setPreview({ factors: [0, 1] });
                } else {
                    setPreview({ value: 0 });
                }
                updateScore(player.id, col.id, undefined);
                setUiState((p: any) => ({ ...p, overwriteMode: true }));
            }
        }
    };

    // --- Joystick Logic (Swipe to Switch Players) ---
    const touchStartRef = useRef<{ x: number, y: number, round: number } | null>(null);
    const hasTriggeredRef = useRef(false);
    const touchAxisRef = useRef<'horizontal' | 'vertical' | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        const round = touchGestureGuard.getState().round;
        if (e.touches.length !== 1 || !touchGestureGuard.isAllowed(round)) {
            touchStartRef.current = null;
            hasTriggeredRef.current = false;
            touchAxisRef.current = null;
            return;
        }
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, round };
        hasTriggeredRef.current = false;
        touchAxisRef.current = null;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        // 1. Basic Guards
        if (touchStartRef.current && !touchGestureGuard.isAllowed(touchStartRef.current.round)) {
            touchStartRef.current = null;
            touchAxisRef.current = null;
            return;
        }
        if (!touchStartRef.current || hasTriggeredRef.current || !isPanelOpen || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;

        // 2. Axis Locking: decide once for this gesture. A vertical scroll must
        // not become a player swipe just because a later sample leans sideways.
        if (!touchAxisRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            touchAxisRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        }

        if (touchAxisRef.current !== 'horizontal') return;

        // 3. Threshold Trigger (30px)
        if (Math.abs(dx) > 30) {
            hasTriggeredRef.current = true; // Lock

            // Trigger Haptic
            if (navigator.vibrate) navigator.vibrate(15);

            // Determine current focused player ID
            const currentPlayerId = editingCell?.playerId || editingPlayerId;

            if (currentPlayerId) {

                // [Fix] Handle Auto-Commit for Player Name editing
                if (editingPlayerId) {
                    // Explicitly prevent defaults to avoid side effects (scrolling/selection)
                    if (e.cancelable) e.preventDefault();

                    // 1. Force blur immediately to close keyboard
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }

                    // 2. Commit current name
                    eventHandlers.handlePlayerNameSubmit(editingPlayerId, uiState.tempPlayerName, false);

                    // 3. Explicitly force input focused state to false
                    // This is critical to exit the "compact" layout mode
                    setUiState((p: any) => ({ ...p, isInputFocused: false }));
                }

                // 4. Action: Switch Player
                // Right Swipe (+X) -> Next Player
                // Left Swipe (-X) -> Previous Player
                if (dx > 0) {
                    // [Note] Auto-commit is handled by useEffect cleanup in InputPanel when editingCell changes
                    swipeTriggerRef.current = true; // Mark as swipe-triggered
                    eventHandlers.moveToNextPlayer(currentPlayerId);
                } else {
                    swipeTriggerRef.current = true; // Mark as swipe-triggered
                    eventHandlers.moveToPrevPlayer(currentPlayerId);
                }
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // [Fix] Ghost Click Prevention
        // If a swipe action was triggered, we must prevent the subsequent 'click' event
        // that the browser fires after touchend. If we don't, the click will re-focus the input
        // because the finger is lifted while still over the input element.
        if (hasTriggeredRef.current) {
            if (e.cancelable) e.preventDefault();
        }
        touchStartRef.current = null;
        hasTriggeredRef.current = false;
        touchAxisRef.current = null;
    };

    const handleTouchCancel = () => {
        touchStartRef.current = null;
        hasTriggeredRef.current = false;
        touchAxisRef.current = null;
    };

    let mainContentNode: React.ReactNode = null;
    let sidebarContentNode: React.ReactNode = null;
    let onNextAction = () => { };
    let nextButtonContent: React.ReactNode = undefined;

    let activePlayer: Player | undefined;
    let activeColumn: ScoreColumn | undefined;
    let isEditingPlayerName = false;
    let isTotalMode = false;

    if (editingPlayerId) {
        activePlayer = session.players.find((p: any) => p.id === editingPlayerId);
        isEditingPlayerName = true;

        if (activePlayer) {
            mainContentNode = (
                <PlayerEditor
                    // [Fix] Add key prop to force remount when switching players.
                    // This is the most reliable way to clear focus state and ensure a fresh input render.
                    key={activePlayer.id}
                    player={activePlayer}
                    savedPlayers={savedPlayers} // Updated Prop Name
                    allSavedPlayers={allSavedPlayers}
                    session={session}
                    tempName={uiState.tempPlayerName}
                    setTempName={(name) => setUiState((p: any) => ({ ...p, tempPlayerName: name }))}
                    isInputFocused={uiState.isInputFocused} setIsInputFocused={(focused) => setUiState((p: any) => ({ ...p, isInputFocused: focused }))}
                    // [Update] Set isColorManuallySet to true when color is updated
                    onUpdatePlayerColor={(color) => onUpdateSession({ ...session, players: session.players.map((p: any) => p.id === editingPlayerId ? { ...p, color, isColorManuallySet: true } : p) })}
                    // [Update] Added linkedId optional param
                    onNameSubmit={(id, name, next, linkedId) => eventHandlers.handlePlayerNameSubmit(id, name, next, linkedId)}
                    onToggleStarter={handleToggleStarter}
                    supportedColors={template.supportedColors} // [New] Pass supportedColors
                    recommendedColors={recommendedColors} // [New] Pass recommendedColors
                />
            );
            sidebarContentNode = <PlayerSettingsPanel player={activePlayer} onToggleStarter={handleToggleStarter} />;
            onNextAction = () => {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                eventHandlers.handlePlayerNameSubmit(activePlayer!.id, uiState.tempPlayerName, true);
            };
        }
    } else if (editingCell) {
        activePlayer = session.players.find((p: any) => p.id === editingCell.playerId);

        // --- SPECIAL MODE: TOTAL ADJUSTMENT ---
        if (editingCell.colId === '__TOTAL__') {
            isTotalMode = true;
            if (activePlayer) {
                const dummyCol: ScoreColumn = {
                    id: '__TOTAL__',
                    name: t('input_total_adjust'),
                    formula: 'a1',
                    inputType: 'keypad',
                    isScoring: true,
                    rounding: 'none'
                };

                const currentTotal = activePlayer.totalScore;
                const currentBonus = activePlayer.bonusScore || 0;
                const baseScore = currentTotal - currentBonus;

                mainContentNode = <NumericKeypad
                    value={{ value: previewValue }}
                    onChange={(val: any) => {
                        setPreview(val.value);
                        const targetTotal = parseFloat(String(val.value));
                        if (!isNaN(targetTotal)) {
                            updatePlayerMeta(activePlayer!.id, { bonusScore: targetTotal - baseScore });
                        }
                    }}
                    column={dummyCol}
                    overwrite={overwriteMode}
                    setOverwrite={(v: boolean) => setUiState((p: any) => ({ ...p, overwriteMode: v }))}
                    onNext={() => {
                        // Use regular navigation logic instead of closing
                        eventHandlers.moveToNext();
                    }}
                    activeFactorIdx={0}
                    setActiveFactorIdx={() => { }}
                    playerId={activePlayer.id}
                />;

                if (canEditPlayers) {
                    sidebarContentNode = <TotalAdjustmentSidebar player={activePlayer} onUpdatePlayer={(u) => updatePlayerMeta(activePlayer!.id, u)} />;
                }

                // Check if last player to show confirm checkmark
                const playerIdx = session.players.findIndex(p => p.id === activePlayer!.id);
                if (playerIdx === session.players.length - 1) {
                    nextButtonContent = <Check size={24} />;
                }

                onNextAction = () => eventHandlers.moveToNext();
            }
        }
        // --- STANDARD COLUMN MODE ---
        else {
            activeColumn = template.columns.find((c: any) => c.id === editingCell.colId);

            if (activeColumn && activePlayer) {
                ({ mainContentNode, sidebarContentNode, onNextAction, nextButtonContent } = buildColumnInputView({
                    player: activePlayer,
                    column: activeColumn,
                    allColumns: template.columns,
                    allPlayers: session.players,
                    previewValue,
                    activeFactorIdx,
                    overwriteMode,
                    setPreview,
                    setActiveFactorIdx,
                    setOverwrite: (overwrite) => setUiState(p => ({ ...p, overwriteMode: overwrite })),
                    updateScore,
                    moveToNext: eventHandlers.moveToNext,
                    t,
                }));
            }
        }
    }

    // --- Auto-Commit on Blur Logic ---
    const commitRef = useRef({ previewValue, activePlayer, activeColumn, session, template, updateScore, isTotalMode });
    useEffect(() => {
        commitRef.current = { previewValue, activePlayer, activeColumn, session, template, updateScore, isTotalMode };
    });

    useEffect(() => {
        return () => {
            const { previewValue, activePlayer, activeColumn, session, template, updateScore, isTotalMode } = commitRef.current;

            if (!activePlayer) return;

            if (isTotalMode) {
                return;
            }

            if (!activeColumn) return;

            const isSumPartsMode = (activeColumn.formula || '').includes('+next');
            const isProductMode = activeColumn.formula.includes('×a2');

            if (isSumPartsMode) {
                const cellScoreObject = activePlayer.scores[activeColumn.id];
                const constant = activeColumn.constants?.c1 ?? 1;
                const hasMultiplier = constant !== 1;

                if (isProductMode) {
                    let currentFactors = [0, 1];
                    if (previewValue && typeof previewValue === 'object' && previewValue.factors) {
                        currentFactors = previewValue.factors;
                    }
                    const n1 = parseFloat(String(currentFactors[0])) || 0;
                    const n2 = parseFloat(String(currentFactors[1])) || 0;

                    if (n1 !== 0) {
                        const product = n1 * n2;
                        const currentHistory = getScoreHistory(cellScoreObject);
                        const newHistory = [...currentHistory, String(product)];
                        const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                        updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                    }
                } else {
                    const input = parseFloat(String(getRawValue(previewValue))) || 0;
                    if (input !== 0) {
                        const valToAdd = hasMultiplier ? input * constant : input;
                        const currentHistory = getScoreHistory(cellScoreObject);
                        const newHistory = [...currentHistory, String(valToAdd)];
                        const newSum = newHistory.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                        updateScore(activePlayer.id, activeColumn.id, { value: newSum, history: newHistory });
                    }
                }
            }
        };
    }, [editingCell?.playerId, editingCell?.colId]);

    // [New] Show panel if it's explicitly open OR if it's forced by short list logic OR Toolbox is toggled on
    // [Fix] Hide panel even in short-list/toolbox mode if we are editing title (keyboard open)
    const isVisible = (isPanelOpen || isShortList || isToolboxOpen) && !isEditingTitle;
    const isStandalone = typeof document !== 'undefined' && document.documentElement.dataset.standalone === 'true';

    // Logic: Are we in a state where the panel is just a placeholder spacer?
    // If no cell/player is selected, but short list/toolbox forces panel height -> Placeholder
    const isPlaceholderMode = (isShortList || isToolboxOpen) && !isPanelOpen;

    return (
        <>
        {/* Cover the browser dock gap without changing the panel or keypad dimensions. */}
        {isVisible && !isStandalone ? (
            <div
                data-input-panel-bottom-fill="true"
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 z-50 bg-input-bg"
                style={{ height: bottomOffset }}
            />
        ) : null}
        <div
            data-session-input-panel="true"
            className={`absolute left-0 right-0 z-50 bg-modal-bg backdrop-blur-sm border-t border-surface-border shadow-[0_-8px_30px_rgb(var(--c-black)_/_0.2)] transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ height: panelHeight, bottom: bottomOffset }}
                // [Added] Joystick Touch Handlers
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
        >
            {activePlayer && !isPlaceholderMode && (
                <InputPanelHeader
                    player={activePlayer}
                    col={activeColumn}
                    isEditingPlayer={isEditingPlayerName}
                    onClear={handleClear}
                    onDirectionToggle={handleDirectionToggle}
                    direction={advanceDirection}
                    isTotalMode={isTotalMode}
                    isVoiceEnabled={isVoiceEnabled}
                    onToggleVoice={onToggleVoice}
                    showSwipeHint={showSwipeHint}
                />
            )}

            <div data-session-input-content="true" className="flex-1 min-h-0 bg-modal-bg relative">
                {mainContentNode && !isPlaceholderMode && (
                    <InputPanelLayout onNext={onNextAction} nextButtonDirection={advanceDirection} sidebarContent={sidebarContentNode} nextButtonContent={nextButtonContent} isCompact={isInputFocused}>
                        {mainContentNode}
                    </InputPanelLayout>
                )}

                {/* Smart Spacer (Toolbox) Mode */}
                {isPlaceholderMode && (
                    <SmartSpacer
                        session={session}
                        template={template}
                        onTakePhoto={onTakePhoto}
                        onScreenshot={() => onScreenshotRequest?.('simple')} // Default to simple for quick screenshot
                        onUpdateSession={onUpdateSession} // [Fix] Pass updater to allow order shuffling
                        mediaOnly={mediaOnlyTools}
                        onMemoFocusChange={onToolboxInputFocusChange}
                        topContent={toolboxTopContent}
                    />
                )}
            </div>
        </div>
        </>
    );
};

export default InputPanel;
