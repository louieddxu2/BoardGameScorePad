import React, { useState, useEffect, useRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, RefreshCw, Users } from 'lucide-react';
import { useToolsTranslation } from '../../../i18n/tools';
import { GameSession } from '../../../types';
import { Candidate, PrototypePlayer, PrototypeTurnOrderEntry } from './types';
import { usePlayerSelectorPrototypeRenderer } from './usePlayerSelectorPrototypeRenderer';
import { recommendationService } from '../../../features/recommendation/RecommendationService';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { drawTurnOrder, getStarterPrototypePlayerId } from './turnOrder';

interface PlayerSelectorPrototypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: GameSession;
    onUpdateSession?: (session: GameSession) => void;
}

interface PlayerSelectorPrototypeSurfaceHandle {
    resetEngine: () => void;
    closeAllPalettes: () => void;
    getSvg: () => SVGSVGElement | null;
}

interface PlayerSelectorPrototypeSurfaceProps {
    candidates: Candidate[];
    randomNames: string[];
    turnOrder: PrototypeTurnOrderEntry[];
    highlightedPlayerId: string | null;
    starterPlayerId: string | null;
    shouldRetreatPlayers: boolean;
    isInteractionLocked: boolean;
    onPrototypePlayersChange: (players: PrototypePlayer[]) => void;
    onCandidateLocked: (candidate: Candidate) => void;
}

const PlayerSelectorPrototypeSurface = React.forwardRef<PlayerSelectorPrototypeSurfaceHandle, PlayerSelectorPrototypeSurfaceProps>(({
    candidates,
    randomNames,
    turnOrder,
    highlightedPlayerId,
    starterPlayerId,
    shouldRetreatPlayers,
    isInteractionLocked,
    onPrototypePlayersChange,
    onCandidateLocked
}, ref) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const { resetEngine, closeAllPalettes } = usePlayerSelectorPrototypeRenderer({
        svgRef,
        candidates,
        randomNames,
        turnOrder,
        highlightedPlayerId,
        starterPlayerId,
        shouldRetreatPlayers,
        isInteractionLocked,
        onPrototypePlayersChange,
        onCandidateLocked
    });

    useImperativeHandle(ref, () => ({
        resetEngine,
        closeAllPalettes,
        getSvg: () => svgRef.current
    }), [resetEngine, closeAllPalettes]);

    return <svg ref={svgRef} className="w-full h-full absolute inset-0"></svg>;
});

PlayerSelectorPrototypeSurface.displayName = 'PlayerSelectorPrototypeSurface';

const PlayerSelectorPrototypeModal: React.FC<PlayerSelectorPrototypeModalProps> = ({
    isOpen,
    onClose,
    session,
    onUpdateSession
}) => {
    const { t } = useToolsTranslation();
    const surfaceRef = useRef<PlayerSelectorPrototypeSurfaceHandle | null>(null);
    const drawIntervalRef = useRef<number | null>(null);
    const drawTimeoutRef = useRef<number | null>(null);
    const playerIdsRef = useRef<string>('');
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [players, setPlayers] = useState<PrototypePlayer[]>([]);
    const [phase, setPhase] = useState<'selecting' | 'drawing' | 'result'>('selecting');
    const [turnOrder, setTurnOrder] = useState<PrototypeTurnOrderEntry[]>([]);
    const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);
    
    // 實體返回鍵與 z-index 管理防線
    const { zIndex } = useModalBackHandler(isOpen, onClose, 'player-selector-prototype');

    // 取得推薦候選人
    useEffect(() => {
        if (!isOpen) return;

        const loadCandidates = async () => {
            try {
                const context = {
                    gameName: session.name, // 修正：使用 session.name 替代不存在的 gameName
                    playerCount: session.players.length,
                    knownPlayerIds: session.players.map(p => p.id)
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
                    const fallbackPlayers = session.players
                        .filter(p => !existingNames.has(p.name))
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
    }, [isOpen, session]);

    const randomNames = t('picker_prototype_random_names').split(',');
    const starterPlayerId = getStarterPrototypePlayerId(turnOrder) || null;
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
            playerIdsRef.current = '';
        }
    }, [isOpen]);

    useEffect(() => {
        return () => {
            stopDrawTimers();
        };
    }, []);

    const handlePlayersChange = useCallback((updatedPlayers: PrototypePlayer[]) => {
        const nextPlayerIds = updatedPlayers.map(player => player.id).join('|');
        const didPlayerSetChange = nextPlayerIds !== playerIdsRef.current;
        playerIdsRef.current = nextPlayerIds;

        setPlayers(updatedPlayers);
        if (didPlayerSetChange) {
            setTurnOrder([]);
            setHighlightedPlayerId(null);
            setPhase('selecting');
        }
    }, []);

    if (!isOpen) return null;

    const startDraw = () => {
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
            setHighlightedPlayerId(getStarterPrototypePlayerId(result) || null);
            setPhase('result');
        }, 2000);
    };

    const handleConfirm = () => {
        // 座位順序 (Seat Order) 排序預覽
        const svg = surfaceRef.current?.getSvg();
        if (svg && players.length > 0) {
            const rect = svg.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;

            // 計算相對於幾何中心的物理角度
            const playersWithAngle = players.map(p => {
                const dx = p.x - cx;
                const dy = p.y - cy;
                const angle = Math.atan2(dy, dx); // -PI to PI
                return { ...p, angle };
            });

            // 依順時針方向排序
            const sortedBySeat = [...playersWithAngle].sort((a, b) => a.angle - b.angle);
            console.log("[Visual Selector] Prototype players sorted by clockwise seat order:", sortedBySeat);
        } else {
            console.log("[Visual Selector] No players selected or SVG ref is empty.");
        }

        onClose();
    };

    return createPortal(
        <div 
            className="fixed inset-0 bg-app-bg-deep flex flex-col animate-in fade-in duration-200 text-txt-primary select-none"
            style={{ zIndex }}
        >
            {/* Header */}
            <header className="bg-modal-bg border-b border-modal-border text-txt-title p-4 shadow-md sticky top-0 z-20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-secondary" />
                    <h1 className="text-lg font-bold tracking-tight">{t('picker_prototype_title')}</h1>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 -mr-2 text-txt-muted hover:text-txt-title hover:bg-modal-bg-elevated rounded-full transition-colors"
                    aria-label={t('picker_prototype_close')}
                >
                    <X className="w-5 h-5" />
                </button>
            </header>

            {/* Canvas Area */}
            <main className="flex-1 w-full relative bg-app-bg-deep overflow-hidden touch-none select-none">
                <PlayerSelectorPrototypeSurface
                    ref={surfaceRef}
                    candidates={candidates}
                    randomNames={randomNames}
                    turnOrder={turnOrder}
                    highlightedPlayerId={highlightedPlayerId}
                    starterPlayerId={starterPlayerId}
                    shouldRetreatPlayers={phase === 'result'}
                    isInteractionLocked={phase === 'drawing' || phase === 'result'}
                    onPrototypePlayersChange={handlePlayersChange}
                    onCandidateLocked={(candidate) => {
                        console.log("[Visual Selector] Candidate locked:", candidate);
                    }}
                />
                
                {/* Empty State Hint */}
                {players.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300">
                        <span className="text-txt-muted font-medium text-sm md:text-base tracking-widest opacity-60 px-6 text-center">
                            {t('picker_prototype_empty')}
                        </span>
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
                        <div className="pointer-events-auto grid grid-cols-2 gap-3 min-w-[280px] max-w-[min(380px,calc(100vw-28px))] rounded-3xl bg-app-bg-deep/45 p-2 backdrop-blur-[2px]">
                            <button
                                onClick={handleConfirm}
                                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-primary-deep hover:bg-brand-primary text-white shadow-2xl transition-transform active:scale-95 text-sm font-bold border border-white/10"
                            >
                                <Play size={16} />
                                <span>{t('picker_prototype_start_game')}</span>
                            </button>
                            <button
                                onClick={startDraw}
                                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-modal-bg-elevated/95 border border-surface-border hover:bg-surface-hover text-txt-secondary shadow-2xl transition-transform active:scale-95 text-sm font-bold"
                            >
                                <RefreshCw size={16} />
                                <span>{t('picker_prototype_restart')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Panel */}
            <footer className="bg-modal-bg border-t border-modal-border p-4 flex flex-col gap-3 shrink-0">
                {/* Selected Players list */}
                {players.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-txt-secondary tracking-wider">
                            {t('picker_prototype_selected_players')} ({players.length})
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto no-scrollbar">
                            {players.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-modal-bg-elevated rounded-full border border-surface-border text-xs font-bold transition-all shadow-sm"
                                >
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: p.color }}
                                    ></div>
                                    <span>{p.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </footer>
        </div>,
        document.body
    );
};

export default PlayerSelectorPrototypeModal;
