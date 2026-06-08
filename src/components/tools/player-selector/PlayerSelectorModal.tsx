import React, { useState, useEffect, useRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, RefreshCw } from 'lucide-react';
import { useToolsTranslation } from '../../../i18n/tools';
import { GameSession } from '../../../types';
import { Candidate, SelectorPlayer, SelectorTurnOrderEntry } from './types';
import { usePlayerSelectorRenderer } from './usePlayerSelectorRenderer';
import { recommendationService } from '../../../features/recommendation/RecommendationService';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { drawTurnOrder, getStarterSelectorPlayerId } from './turnOrder';

interface PlayerSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: GameSession;
    onUpdateSession?: (session: GameSession) => void;
}

interface PlayerSelectorSurfaceHandle {
    resetEngine: () => void;
    closeAllPalettes: () => void;
    getSvg: () => SVGSVGElement | null;
}

interface PlayerSelectorSurfaceProps {
    candidates: Candidate[];
    randomNames: string[];
    turnOrder: SelectorTurnOrderEntry[];
    highlightedPlayerId: string | null;
    starterPlayerId: string | null;
    shouldRetreatPlayers: boolean;
    isInteractionLocked: boolean;
    expectedPlayerCount?: number;
    onSelectorPlayersChange: (players: SelectorPlayer[]) => void;
    onCandidateLocked: (candidate: Candidate) => void;
}

const PlayerSelectorSurface = React.forwardRef<PlayerSelectorSurfaceHandle, PlayerSelectorSurfaceProps>(({
    candidates,
    randomNames,
    turnOrder,
    highlightedPlayerId,
    starterPlayerId,
    shouldRetreatPlayers,
    isInteractionLocked,
    expectedPlayerCount = 0,
    onSelectorPlayersChange,
    onCandidateLocked
}, ref) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const { resetEngine, closeAllPalettes } = usePlayerSelectorRenderer({
        svgRef,
        candidates,
        randomNames,
        turnOrder,
        highlightedPlayerId,
        starterPlayerId,
        shouldRetreatPlayers,
        isInteractionLocked,
        expectedPlayerCount,
        onSelectorPlayersChange,
        onCandidateLocked
    });

    useImperativeHandle(ref, () => ({
        resetEngine,
        closeAllPalettes,
        getSvg: () => svgRef.current
    }), [resetEngine, closeAllPalettes]);

    return <svg ref={svgRef} className="w-full h-full absolute inset-0 touch-none select-none"></svg>;
});

PlayerSelectorSurface.displayName = 'PlayerSelectorSurface';

const PlayerSelectorModal: React.FC<PlayerSelectorModalProps> = ({
    isOpen,
    onClose,
    session,
    onUpdateSession
}) => {
    const { t } = useToolsTranslation();
    const surfaceRef = useRef<PlayerSelectorSurfaceHandle | null>(null);
    const drawIntervalRef = useRef<number | null>(null);
    const drawTimeoutRef = useRef<number | null>(null);
    const playerIdsRef = useRef<string>('');
    const lastClickTimeRef = useRef<number>(0);
    const clickCountRef = useRef<number>(0);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [players, setPlayers] = useState<SelectorPlayer[]>([]);
    const [phase, setPhase] = useState<'selecting' | 'drawing' | 'result'>('selecting');
    const [turnOrder, setTurnOrder] = useState<SelectorTurnOrderEntry[]>([]);
    const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);
    const [shouldKeepRetreatedLayout, setShouldKeepRetreatedLayout] = useState(false);
    
    // 全螢幕切換防線
    useEffect(() => {
        if (isOpen) {
            try {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log("Fullscreen request was rejected/failed:", err);
                });
            } catch (e) {
                console.log("Fullscreen not supported:", e);
            }
        }
        return () => {
            if (document.fullscreenElement) {
                try {
                    document.exitFullscreen().catch(err => {
                        console.log("Exit fullscreen failed:", err);
                    });
                } catch (e) {
                    console.log("Exit fullscreen not supported:", e);
                }
            }
        };
    }, [isOpen]);

    // 鍵盤 Esc 退出監聽
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    // 連點三次退出處理
    const handleCenterClick = () => {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 400) {
            clickCountRef.current += 1;
        } else {
            clickCountRef.current = 1;
        }
        lastClickTimeRef.current = now;

        if (clickCountRef.current >= 3) {
            clickCountRef.current = 0;
            onClose();
        }
    };

    // 實體返回鍵與 z-index 管理防線
    const { zIndex } = useModalBackHandler(isOpen, onClose, 'player-selector');

    // 取得推薦候選人
    const playersIdsKey = players.map(p => p.linkedPlayerId || p.id).join(',');

    useEffect(() => {
        if (!isOpen) return;

        const loadCandidates = async () => {
            try {
                // 已鎖定的玩家 ID
                const lockedPlayerIds = players
                    .map(p => p.linkedPlayerId)
                    .filter((id): id is string => !!id);

                const context = {
                    gameName: session.name, // 修正：使用 session.name 替代不存在的 gameName
                    playerCount: session.players.length,
                    knownPlayerIds: lockedPlayerIds
                };
                const suggestions = await recommendationService.getPlayerSuggestions(context, 10);
                
                let list: Candidate[] = suggestions.map(s => ({
                    id: s.id,
                    name: s.name,
                    linkedPlayerId: s.id
                }));

                // 推薦不足 4 人，用現有 session 中的玩家名稱補足
                if (list.length < 4) {
                    const existingNames = new Set(list.map(item => item.name));
                    const lockedNames = new Set(players.map(p => p.text));
                    const fallbackPlayers = session.players
                        .filter(p => !existingNames.has(p.name) && !lockedNames.has(p.name))
                        .map(p => ({
                            id: p.id,
                            name: p.name,
                            linkedPlayerId: p.id
                        }));
                    list = [...list, ...fallbackPlayers];
                }

                setCandidates(list);
            } catch (error) {
                console.error("[Visual Selector] Failed to load suggestions, fallback to session players", error);
                const list = session.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    linkedPlayerId: p.id
                }));
                setCandidates(list);
            }
        };

        loadCandidates();
    }, [isOpen, session, playersIdsKey]);

    const randomNames = t('picker_prototype_random_names').split(',');
    const starterPlayerId = getStarterSelectorPlayerId(turnOrder) || null;
    const hasEnoughPlayers = players.length >= session.players.length && session.players.length > 0;

    const stopDrawTimers = () => {
        if (drawIntervalRef.current !== null) {
            window.clearInterval(drawIntervalRef.current);
            drawIntervalRef.current = null;
        }
        if (drawTimeoutRef.current !== null) {
            window.clearTimeout(drawTimeoutRef.current);
            drawTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        if (!isOpen) {
            stopDrawTimers();
            setPhase('selecting');
            setTurnOrder([]);
            setHighlightedPlayerId(null);
            setPlayers([]);
            setShouldKeepRetreatedLayout(false);
            playerIdsRef.current = '';
        }
    }, [isOpen]);

    useEffect(() => {
        return () => {
            stopDrawTimers();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const preventSystemGesture = (event: Event) => {
            if (event.cancelable) event.preventDefault();
        };

        window.addEventListener('gesturestart', preventSystemGesture, { passive: false });
        window.addEventListener('gesturechange', preventSystemGesture, { passive: false });
        window.addEventListener('gestureend', preventSystemGesture, { passive: false });

        return () => {
            window.removeEventListener('gesturestart', preventSystemGesture);
            window.removeEventListener('gesturechange', preventSystemGesture);
            window.removeEventListener('gestureend', preventSystemGesture);
        };
    }, [isOpen]);

    const handlePlayersChange = useCallback((updatedPlayers: SelectorPlayer[]) => {
        const nextPlayerIds = updatedPlayers.map(player => player.id).join('|');
        const didPlayerSetChange = nextPlayerIds !== playerIdsRef.current;
        playerIdsRef.current = nextPlayerIds;

        setPlayers(updatedPlayers);
        if (didPlayerSetChange) {
            setTurnOrder([]);
            setHighlightedPlayerId(null);
            setShouldKeepRetreatedLayout(false);
            setPhase('selecting');
        }
    }, []);

    const startDraw = useCallback(() => {
        if (players.length === 0 || phase === 'drawing') return;

        stopDrawTimers();
        surfaceRef.current?.closeAllPalettes();
        setPhase('drawing');
        setTurnOrder([]);

        let highlightIndex = 0;
        setHighlightedPlayerId(players[highlightIndex % players.length].id);
        drawIntervalRef.current = window.setInterval(() => {
            highlightIndex += 1;
            setHighlightedPlayerId(players[highlightIndex % players.length].id);
        }, 120);

        drawTimeoutRef.current = window.setTimeout(() => {
            stopDrawTimers();
            const result = drawTurnOrder(players);
            setTurnOrder(result);
            setHighlightedPlayerId(getStarterSelectorPlayerId(result) || null);
            setShouldKeepRetreatedLayout(true);
            setPhase('result');
        }, 2000);
    }, [players, phase]);

    // 當人數恰好達到預期人數時，自動觸發隨機抽起始玩家
    useEffect(() => {
        if (
            phase === 'selecting' &&
            session.players.length > 0 &&
            players.length === session.players.length
        ) {
            startDraw();
        }
    }, [players.length, session.players.length, phase, startDraw]);

    if (!isOpen) return null;


    const handleConfirm = () => {
        const svg = surfaceRef.current?.getSvg();
        if (svg && players.length > 0) {
            const rect = svg.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;

            // 1. 找出最早加入的玩家 (players[0]) 作為座位排序起點 (Anchor)
            const anchorPlayer = players[0];
            const anchorAngle = Math.atan2(anchorPlayer.y - cy, anchorPlayer.x - cx);

            // 2. 計算每位玩家相對於 Anchor 的順時針相對角度並排序
            const playersWithRelativeAngle = players.map(p => {
                const dx = p.x - cx;
                const dy = p.y - cy;
                const angle = Math.atan2(dy, dx); // -PI to PI
                let relativeAngle = angle - anchorAngle;
                if (relativeAngle < 0) {
                    relativeAngle += 2 * Math.PI;
                }
                return { ...p, relativeAngle };
            });

            const sortedBySeat = [...playersWithRelativeAngle].sort((a, b) => a.relativeAngle - b.relativeAngle);

            // 3. 安全更新計分板 GameSession (保留歷史分數，僅調整座位與 Starter)
            if (onUpdateSession) {
                const updatedPlayers = sortedBySeat.map(sp => {
                    // 比對 linkedPlayerId 或 name，尋找原本已在計分板中的玩家
                    const existingPlayer = session.players.find(p => 
                        (sp.linkedPlayerId && p.id === sp.linkedPlayerId) || 
                        p.id === sp.id || 
                        p.name === sp.text
                    );

                    const isStarter = sp.id === starterPlayerId;

                    if (existingPlayer) {
                        return {
                            ...existingPlayer,
                            color: sp.color,
                            isStarter
                        };
                    } else {
                        // 新鎖定加入的玩家
                        return {
                            id: sp.linkedPlayerId || sp.id,
                            name: sp.text,
                            color: sp.color,
                            scores: {},
                            totalScore: 0,
                            isStarter,
                            linkedPlayerId: sp.linkedPlayerId
                        };
                    }
                });

                onUpdateSession({
                    ...session,
                    players: updatedPlayers
                });
            }
        }

        onClose();
    };

    return createPortal(
        <div 
            className="fixed inset-0 bg-app-bg-deep flex flex-col animate-in fade-in duration-200 text-txt-primary select-none"
            data-mobile-zoom-ignore="true"
            style={{ zIndex }}
        >
            {/* Canvas Area */}
            <main
                className="flex-1 w-full relative bg-app-bg-deep overflow-hidden touch-none overscroll-none select-none"
                data-testid="player-selector-surface"
                style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
            >
                <PlayerSelectorSurface
                    ref={surfaceRef}
                    candidates={candidates}
                    randomNames={randomNames}
                    turnOrder={turnOrder}
                    highlightedPlayerId={highlightedPlayerId}
                    starterPlayerId={starterPlayerId}
                    shouldRetreatPlayers={shouldKeepRetreatedLayout}
                    isInteractionLocked={phase === 'drawing'}
                    expectedPlayerCount={session.players.length}
                    onSelectorPlayersChange={handlePlayersChange}
                    onCandidateLocked={(candidate) => {
                        console.log("[Visual Selector] Candidate locked:", candidate);
                    }}
                />
                
                {/* Empty State Hint */}
                {phase === 'selecting' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300">
                        <div 
                            className="pointer-events-auto flex flex-col items-center justify-center gap-3 px-6 text-center cursor-pointer select-none"
                            onClick={handleCenterClick}
                        >
                            <span className="text-brand-secondary font-bold text-lg md:text-xl tracking-widest drop-shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-pulse">
                                {t('picker_prototype_empty')}
                            </span>
                            <span className="text-txt-muted text-xs md:text-sm font-medium opacity-50 tracking-wider">
                                {t('picker_prototype_exit_hint')}
                            </span>
                        </div>
                    </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {phase === 'selecting' && hasEnoughPlayers && (
                        <button
                            onClick={startDraw}
                            className="pointer-events-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-brand-primary-deep hover:bg-brand-primary text-white shadow-2xl transition-transform active:scale-95 text-sm font-bold border border-white/10"
                        >
                            <Play size={18} />
                            <span>{t('picker_prototype_draw_order')}</span>
                        </button>
                    )}

                    {phase === 'drawing' && (
                        <div className="px-5 py-3 rounded-2xl bg-modal-bg/90 border border-brand-primary/40 text-brand-primary shadow-2xl text-sm font-bold">
                            {t('picker_picking')}
                        </div>
                    )}

                    {phase === 'result' && (
                        <>
                            <button
                                onClick={startDraw}
                                className="pointer-events-auto absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[86px] items-center justify-center gap-2 rounded-full bg-modal-bg-elevated/95 border border-surface-border hover:bg-surface-hover text-txt-secondary shadow-xl transition-transform active:scale-95 px-4 py-2 text-xs font-bold"
                            >
                                <RefreshCw size={14} />
                                <span>{t('picker_prototype_restart')}</span>
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="pointer-events-auto absolute left-1/2 top-1/2 flex min-w-[172px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 rounded-2xl bg-brand-primary-deep hover:bg-brand-primary text-white shadow-2xl transition-transform active:scale-95 px-7 py-4 text-base font-bold border border-white/10"
                            >
                                <Play size={18} />
                                <span>{t('picker_prototype_start_game')}</span>
                            </button>
                        </>
                    )}
                </div>
            </main>
        </div>,
        document.body
    );
};

export default PlayerSelectorModal;

