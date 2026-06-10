import { useEffect, useRef } from 'react';
import { Candidate, SelectorPlayer, SelectorTurnOrderEntry } from './types';
import { OptionState, SelectorPointerInput, TouchState } from './selectorEngineTypes';
import { getFourCandidatesForTouch } from './selectorCandidates';
import { applyPaletteClick, applyPlayerClick } from './selectorHitTest';
import { drawSelectorSvg } from './selectorPainter';
import { closeSelectorPlayerPalettes } from './selectorDisplay';

const SPRING_K = 0.08;       
const FRICTION = 0.82;       
const MAX_NORMAL_SPEED = 12; 
const ORBIT_RADIUS = 110;     
const BALL_RADIUS = 26;      
const REPULSION_DIST = 64;   

const FINGER_EXCLUSION_RADIUS = 50; 
const OTHER_EXCLUSION_RADIUS = 110;      
const WALL_REPULSION_DIST = BALL_RADIUS + 5;  
const WALL_REPULSION_FORCE = 1.0; 

const FREEZE_TIME_MS = 1000;    
const LOCK_TIME_MS = 750;
const STATIONARY_LOCK_TIME_MS = 2000;
const ANONYMOUS_MOVE_THRESHOLD = 15;
const ANONYMOUS_PLAYER_PREFIX = "\u73a9\u5bb6";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const DEFAULT_COLOR = "#475569";

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
    onSelectorPlayersChange,
    onCandidateLocked
}: UsePlayerSelectorPrototypeRendererProps) => {

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
            touchId: touch.id,
            linkedPlayerId: option.candidate.linkedPlayerId,
            x: option.x,
            y: option.y,
            textRotationDeg: touch.textRotationDeg,
            text: option.text,
            color: option.color,
            state
        });
        callbacksRef.current.onSelectorPlayersChange([...playersRef.current]);
    };

    const physicsLoop = () => {
        if (!isRunningRef.current) return;

        const svg = svgRef.current;
        if (!svg) {
            return;
        }

        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            if (isRunningRef.current) {
                animationFrameIdRef.current = requestAnimationFrame(physicsLoop);
            }
            return;
        }

        if (prevWidthRef.current > 0 && prevHeightRef.current > 0 && 
            (prevWidthRef.current !== rect.width || prevHeightRef.current !== rect.height)) {
            const widthRatio = rect.width / prevWidthRef.current;
            const heightRatio = rect.height / prevHeightRef.current;

            optionsRef.current.forEach(opt => {
                opt.x *= widthRatio;
                opt.y *= heightRatio;
                if (opt.frozenX !== null) opt.frozenX *= widthRatio;
                if (opt.frozenY !== null) opt.frozenY *= heightRatio;
            });
            playersRef.current.forEach(p => {
                p.x *= widthRatio;
                p.y *= heightRatio;
            });
            displayPositionsRef.current.forEach(position => {
                position.x *= widthRatio;
                position.y *= heightRatio;
            });
            activeTouchesRef.current.forEach(t => {
                t.startX *= widthRatio;
                t.startY *= heightRatio;
                t.canvasX *= widthRatio;
                t.canvasY *= heightRatio;
                t.anchorX *= widthRatio;
                t.anchorY *= heightRatio;
            });
        }
        prevWidthRef.current = rect.width;
        prevHeightRef.current = rect.height;

        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const maxPossibleDist = Math.sqrt(cx * cx + cy * cy);
        const now = Date.now();

        // If interaction is locked (e.g. startDraw has closed/cleared the UI), clear touch states
        if (resultDisplayRef.current.isInteractionLocked) {
            if (activeTouchesRef.current.size > 0) {
                activeTouchesRef.current.clear();
                optionsRef.current = [];
            }
        }

        // 1. 更新 Touch 狀態機
        activeTouchesRef.current.forEach((touch, touchId) => {
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            touch.canvasX = x;
            touch.canvasY = y;

            touch.anchorX = (touch.state === 'LOCKED') ? touch.canvasX : touch.startX;
            touch.anchorY = (touch.state === 'LOCKED') ? touch.canvasY : touch.startY;

            const timeAlive = now - touch.spawnTime;
            
            // 只要尚未完成校準，就持續動態偵測並計算座位朝向
            if (!touch.calibrated) {
                // 1. 初始 0.2 秒校準期：錨點 anchor 跟隨手指
                if (timeAlive < 200) {
                    // 校準期：跟手，但保留 startX 作為物理起點以進行瞬間方向偵測
                    touch.anchorX = touch.canvasX;
                    touch.anchorY = touch.canvasY;
                    touch.progress = 0;
                    touch.selectedOptionId = null;
                }

                // 2. 消除螢幕長寬比帶來的角度變形，將朝向還原為 1:1 物理空間
                const dx = touch.canvasX - cx;
                const dy = touch.canvasY - cy;
                const centerDist = Math.sqrt(dx * dx + dy * dy);
                const vecOutX = dx / rect.width;
                const vecOutY = dy / rect.height;
                const outDist = Math.sqrt(vecOutX * vecOutX + vecOutY * vecOutY);
                const normOutX = outDist > 0 ? vecOutX / outDist : 0;
                const normOutY = outDist > 0 ? vecOutY / outDist : 1;

                let bestDirX = normOutX;
                let bestDirY = normOutY;
                let bestTrust = 0;
                // 距離信心度衰減仍相對於螢幕中心計算
                const distanceTrustMultiplier = 1.0 - Math.min(centerDist / maxPossibleDist, 1.0);

                let displayAngle = touch.rotationAngle;
                let displayRx = touch.radiusX;
                let displayRy = touch.radiusY;
                let hasDisplayEllipse = touch.radiusX > 0 && touch.radiusY > 0;

                if (touch.radiusX > 0 && touch.radiusY > 0) {
                    let angleDeg = touch.rotationAngle;
                    if (touch.radiusY > touch.radiusX) angleDeg += 90;
                    const ellipseRad = angleDeg * Math.PI / 180;

                    let ellipseDirX = Math.cos(ellipseRad);
                    let ellipseDirY = Math.sin(ellipseRad);
                    if (ellipseDirX * normOutX + ellipseDirY * normOutY < 0) {
                        ellipseDirX = -ellipseDirX;
                        ellipseDirY = -ellipseDirY;
                    }
                    const ratio = (Math.min(touch.radiusX, touch.radiusY) > 0) 
                        ? Math.max(touch.radiusX, touch.radiusY) / Math.min(touch.radiusX, touch.radiusY) 
                        : 1;

                    if (ratio > 1.1) {
                        bestDirX = ellipseDirX;
                        bestDirY = ellipseDirY;
                        bestTrust = Math.min((ratio - 1.1) * 1.5, 0.85);
                    }
                }

                const moveDx = touch.canvasX - touch.startX;
                const moveDy = touch.canvasY - touch.startY;
                const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
                if (moveDist > 1) {
                    let swipeDirX = moveDx / moveDist;
                    let swipeDirY = moveDy / moveDist;
                    if (swipeDirX * normOutX + swipeDirY * normOutY < 0) {
                        swipeDirX = -swipeDirX;
                        swipeDirY = -swipeDirY;
                    }
                    const swipeTrust = Math.min((moveDist - 1) * 0.1, 0.85);

                    if (swipeTrust > bestTrust) {
                        bestDirX = swipeDirX;
                        bestDirY = swipeDirY;
                        bestTrust = swipeTrust;

                        displayAngle = Math.atan2(moveDy, moveDx) * 180 / Math.PI;
                        const t = swipeTrust / 0.85;
                        displayRx = 16 + t * 16;
                        displayRy = 16 - t * 4;
                        hasDisplayEllipse = true;
                    }
                }

                const finalTrust = bestTrust * distanceTrustMultiplier;
                const humanDirX = bestDirX * finalTrust + normOutX * (1 - finalTrust);
                const humanDirY = bestDirY * finalTrust + normOutY * (1 - finalTrust);

                touch.displayAngle = displayAngle;
                touch.displayRx = displayRx;
                touch.displayRy = displayRy;
                touch.hasDisplayEllipse = hasDisplayEllipse;

                const humanLen = Math.sqrt(humanDirX * humanDirX + humanDirY * humanDirY) || 1;
                touch.humanAngleRad = Math.atan2(humanDirY / humanLen, humanDirX / humanLen);
                touch.forwardAngleRad = touch.humanAngleRad + Math.PI;
                touch.textRotationDeg = (touch.humanAngleRad * 180 / Math.PI) - 90;

                // 4. 當時間越過 200ms 時，在此影格的最後一次性將起點 startX 鎖定在當前位置，
                //    並標記 calibrated = true。此後不再進入此 if 分支，從而永久封存最終方向！
                if (timeAlive >= 200) {
                    touch.startX = touch.canvasX;
                    touch.startY = touch.canvasY;
                    touch.anchorX = touch.canvasX;
                    touch.anchorY = touch.canvasY;
                    touch.calibrated = true;
                }
            }

            if (touch.state === 'CHOOSING') {
                if (timeAlive > FREEZE_TIME_MS && !touch.optionsFrozen) {
                    touch.optionsFrozen = true;
                    optionsRef.current.filter(o => o.touchId === touchId).forEach(o => {
                        o.frozenX = o.x;
                        o.frozenY = o.y;
                    });
                }

                const dx = touch.canvasX - touch.startX;
                const dy = touch.canvasY - touch.startY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > ANONYMOUS_MOVE_THRESHOLD) {
                    touch.stationaryStartTime = now;
                    const joyAngle = Math.atan2(dy, dx);
                    let minDiff = Infinity;
                    let bestOptId: number | null = null;

                    const angleOffsets = [-Math.PI / 2, Math.PI / 2, -Math.PI / 6, Math.PI / 6];
                    optionsRef.current.filter(o => o.touchId === touchId).forEach(o => {
                        const targetAngle = touch.forwardAngleRad + angleOffsets[o.idx];
                        let dAngle = joyAngle - targetAngle;
                        dAngle = Math.atan2(Math.sin(dAngle), Math.cos(dAngle));
                        const diff = Math.abs(dAngle);

                        if (diff < minDiff) {
                            minDiff = diff;
                            bestOptId = o.id;
                        }
                    });

                    if (bestOptId !== touch.selectedOptionId) {
                        touch.selectedOptionId = bestOptId;
                        touch.selectionStartTime = now;
                        touch.progress = 0;
                    } else {
                        touch.progress = (now - touch.selectionStartTime) / LOCK_TIME_MS;
                        if (touch.progress >= 1.0) {
                            touch.state = 'LOCKED';
                            touch.progress = 1.0;
                            if (navigator.vibrate) navigator.vibrate(50);

                            const lockedOpt = optionsRef.current.find(o => o.id === touch.selectedOptionId);
                            if (lockedOpt) {
                                 lockedOpt.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                                 optionsRef.current = optionsRef.current.filter(o => {
                                     if (o.touchId !== touchId) return true;
                                     return o.id === touch.selectedOptionId;
                                 });
                                 materializePlayer(touch, lockedOpt, 'COLOR_PICKING');
                                 removeOptionsForTouch(touchId);
                                 callbacksRef.current.onCandidateLocked(lockedOpt.candidate);
                             }
                        }
                    }
                } else {
                    touch.selectedOptionId = null;
                    touch.progress = (now - touch.stationaryStartTime) / STATIONARY_LOCK_TIME_MS;
                    if (touch.progress >= 1.0) {
                        const anonymousName = getNextAnonymousPlayerName();
                        const anonymousCandidate = {
                            id: `anonymous_${Date.now()}_${String(touchId)}`,
                            name: anonymousName
                        };
                        const anonymousOptionId = optionIdCounterRef.current++;

                        touch.state = 'LOCKED';
                        touch.progress = 1.0;
                        touch.selectedOptionId = anonymousOptionId;
                        if (navigator.vibrate) navigator.vibrate(50);

                        const anonymousOption: OptionState = {
                            id: anonymousOptionId,
                            touchId,
                            idx: 0,
                            x: touch.anchorX,
                            y: touch.anchorY,
                            vx: 0,
                            vy: 0,
                            frozenX: touch.anchorX,
                            frozenY: touch.anchorY,
                            text: anonymousName,
                            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
                            candidate: anonymousCandidate
                        };

                        materializePlayer(touch, anonymousOption, 'COLOR_PICKING');
                        removeOptionsForTouch(touchId);
                    }
                }
            }
        });

        // 1.5 更新已物化但仍在觸摸鎖定狀態的玩家位置與旋轉角度（帶有平滑彈線效果與手指排斥力，保持與原本相同的手指前方距離）
        playersRef.current.forEach(p => {
            if (p.touchId === undefined) return;
            const touch = activeTouchesRef.current.get(p.touchId) ??
                          activeTouchesRef.current.get(String(p.touchId)) ??
                          activeTouchesRef.current.get(Number(p.touchId));
            if (touch && touch.state === 'LOCKED') {
                let vel = playerVelocitiesRef.current.get(p.id);
                if (!vel) {
                    vel = { vx: 0, vy: 0 };
                    playerVelocitiesRef.current.set(p.id, vel);
                }

                const lockedRadius = ORBIT_RADIUS / 2;
                const targetX = touch.anchorX + Math.cos(touch.forwardAngleRad) * lockedRadius;
                const targetY = touch.anchorY + Math.sin(touch.forwardAngleRad) * lockedRadius;

                // 1. 彈簧拉力
                vel.vx += (targetX - p.x) * (SPRING_K * 2);
                vel.vy += (targetY - p.y) * (SPRING_K * 2);

                // 2. 引入手指排斥力 (Finger Exclusion Force)，以維持原汁原味的手指前方距離！
                const dx = p.x - touch.anchorX;
                const dy = p.y - touch.anchorY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = FINGER_EXCLUSION_RADIUS + BALL_RADIUS + 2; // 50 + 26 + 2 = 78

                if (dist < minDist && dist > 0.1) {
                    const penetration = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    vel.vx += nx * penetration * 0.85;
                    vel.vy += ny * penetration * 0.85;
                }

                // 3. 摩擦力與限速
                vel.vx *= FRICTION;
                vel.vy *= FRICTION;

                const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
                if (speed > MAX_NORMAL_SPEED) {
                    vel.vx = (vel.vx / speed) * MAX_NORMAL_SPEED;
                    vel.vy = (vel.vy / speed) * MAX_NORMAL_SPEED;
                }

                p.x += vel.vx;
                p.y += vel.vy;
                p.textRotationDeg = touch.textRotationDeg;
            }
        });

        optionsRef.current.forEach(opt => {
            const touch = activeTouchesRef.current.get(opt.touchId);
            if (!touch) return;

            if (touch.state === 'CHOOSING') {
                if (touch.optionsFrozen) {
                    const fx = opt.frozenX !== null ? opt.frozenX : opt.x;
                    const fy = opt.frozenY !== null ? opt.frozenY : opt.y;
                    opt.vx += (fx - opt.x) * (SPRING_K * 2.5);
                    opt.vy += (fy - opt.y) * (SPRING_K * 2.5);
                } else {
                    const angleOffsets = [-Math.PI / 2, Math.PI / 2, -Math.PI / 6, Math.PI / 6];
                    const targetAngle = touch.forwardAngleRad + angleOffsets[opt.idx];
                    const targetX = touch.anchorX + Math.cos(targetAngle) * ORBIT_RADIUS;
                    const targetY = touch.anchorY + Math.sin(targetAngle) * ORBIT_RADIUS;
                    const currentK = (now - touch.spawnTime) < 200 ? 0.4 : SPRING_K;
                    opt.vx += (targetX - opt.x) * currentK;
                    opt.vy += (targetY - opt.y) * currentK;
                }
            } else if (touch.state === 'LOCKED') {
                const lockedRadius = ORBIT_RADIUS / 2;
                opt.vx += (touch.anchorX + Math.cos(touch.forwardAngleRad) * lockedRadius - opt.x) * (SPRING_K * 2);
                opt.vy += (touch.anchorY + Math.sin(touch.forwardAngleRad) * lockedRadius - opt.y) * (SPRING_K * 2);
            }
        });

        for (let i = 0; i < optionsRef.current.length; i++) {
            for (let j = i + 1; j < optionsRef.current.length; j++) {
                const b1 = optionsRef.current[i];
                const b2 = optionsRef.current[j];
                const dx = b1.x - b2.x;
                const dy = b1.y - b2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < REPULSION_DIST && dist > 0.1) {
                    const force = (REPULSION_DIST - dist) * 0.4;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    b1.vx += nx * force;
                    b1.vy += ny * force;
                    b2.vx -= nx * force;
                    b2.vy -= ny * force;
                }
            }
        }

        optionsRef.current.forEach(opt => {
            const speed = Math.sqrt(opt.vx * opt.vx + opt.vy * opt.vy);
            if (speed > MAX_NORMAL_SPEED) {
                opt.vx = (opt.vx / speed) * MAX_NORMAL_SPEED;
                opt.vy = (opt.vy / speed) * MAX_NORMAL_SPEED;
            }
        });

        optionsRef.current.forEach(opt => {
            const touch = activeTouchesRef.current.get(opt.touchId);
            if (!touch) return;

            const fVecX = touch.anchorX - cx;
            const fVecY = touch.anchorY - cy;
            const fLen = Math.sqrt(fVecX * fVecX + fVecY * fVecY);

            if (fLen > 0.1) {
                const nx = fVecX / fLen;
                const ny = fVecY / fLen;
                const bx = opt.x - cx;
                const by = opt.y - cy;
                const d = bx * nx + by * ny;

                if (d < BALL_RADIUS + 2) {
                    const penetration = (BALL_RADIUS + 2) - d;
                    opt.vx += nx * penetration * 0.85;
                    opt.vy += ny * penetration * 0.85;
                }
            }

            activeTouchesRef.current.forEach((otherTouch, otherTouchId) => {
                const isOwnBall = (opt.touchId === otherTouchId);
                const baseExclusionRadius = isOwnBall ? FINGER_EXCLUSION_RADIUS : OTHER_EXCLUSION_RADIUS;

                const dx = opt.x - otherTouch.anchorX;
                const dy = opt.y - otherTouch.anchorY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = baseExclusionRadius + BALL_RADIUS + 2;

                if (dist < minDist && dist > 0.1) {
                    const penetration = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    opt.vx += nx * penetration * 0.85;
                    opt.vy += ny * penetration * 0.85;
                }
            });

            if (opt.x < WALL_REPULSION_DIST) opt.vx += (WALL_REPULSION_DIST - opt.x) * WALL_REPULSION_FORCE;
            if (opt.x > rect.width - WALL_REPULSION_DIST) opt.vx -= (opt.x - (rect.width - WALL_REPULSION_DIST)) * WALL_REPULSION_FORCE;
            if (opt.y < WALL_REPULSION_DIST) opt.vy += (WALL_REPULSION_DIST - opt.y) * WALL_REPULSION_FORCE;
            if (opt.y > rect.height - WALL_REPULSION_DIST) opt.vy -= (opt.y - (rect.height - WALL_REPULSION_DIST)) * WALL_REPULSION_FORCE;
        });

        optionsRef.current.forEach(opt => {
            opt.vx *= FRICTION;
            opt.vy *= FRICTION;
            opt.x += opt.vx;
            opt.y += opt.vy;
        });

        drawSelectorSvg({
            svg,
            rect,
            players: playersRef.current,
            options: optionsRef.current,
            activeTouches: activeTouchesRef.current,
            displayPositions: displayPositionsRef.current,
            turnOrder: resultDisplayRef.current.turnOrder,
            highlightedPlayerId: resultDisplayRef.current.highlightedPlayerId,
            starterPlayerId: resultDisplayRef.current.starterPlayerId,
            shouldRetreatPlayers: resultDisplayRef.current.shouldRetreatPlayers
        });

        if (isRunningRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(physicsLoop);
        }
    };

    const checkColorPaletteClick = (clickX: number, clickY: number): boolean => {
        const svg = svgRef.current;
        if (!svg) return false;

        const rect = svg.getBoundingClientRect();
        const result = applyPaletteClick(
            playersRef.current,
            { x: clickX - rect.left, y: clickY - rect.top },
            PALETTE
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
            { x: clickX - rect.left, y: clickY - rect.top }
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

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        isRunningRef.current = true;
        animationFrameIdRef.current = requestAnimationFrame(physicsLoop);

        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            if (resultDisplayRef.current.isInteractionLocked) return;
            for (const t of Array.from(e.changedTouches)) {
                if (checkColorPaletteClick(t.clientX, t.clientY)) continue;
                if (checkPlayerClick(t.clientX, t.clientY)) continue;
                if (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0) continue;

                // 限制人數，大於等於預期人數時阻止新氣泡生成
                const expected = expectedCountRef.current;
                if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
                    continue;
                }

                handleStart(getTouchInput(t));
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                handleMove(getTouchInput(t));
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                handleEnd(t.identifier);
            }
        };

        const onTouchCancel = (e: TouchEvent) => {
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                handleEnd(t.identifier);
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            if (resultDisplayRef.current.isInteractionLocked) return;
            if (checkColorPaletteClick(e.clientX, e.clientY)) return;
            if (checkPlayerClick(e.clientX, e.clientY)) return;
            if (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0) return;

            // 限制人數，大於等於預期人數時阻止新氣泡生成
            const expected = expectedCountRef.current;
            if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
                return;
            }

            if (typeof svg.setPointerCapture === 'function') {
                try {
                    svg.setPointerCapture(e.pointerId);
                } catch {
                    // Pointer capture can fail if the browser cancels the pointer immediately.
                }
            }

            handleStart(getPointerInput(e));
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!activeTouchesRef.current.has(e.pointerId)) return;
            e.preventDefault();
            handleMove(getPointerInput(e));
        };

        const onPointerEnd = (e: PointerEvent) => {
            e.preventDefault();
            if (typeof svg.releasePointerCapture === 'function') {
                try {
                    svg.releasePointerCapture(e.pointerId);
                } catch {
                    // Pointer capture may already have been released by the browser.
                }
            }
            handleEnd(e.pointerId);
        };

        const supportsPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';

        let mouseIsDown = false;
        const MOUSE_ID = 'mouse';

        const onMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            if (resultDisplayRef.current.isInteractionLocked) return;
            if (checkColorPaletteClick(e.clientX, e.clientY)) return;
            if (checkPlayerClick(e.clientX, e.clientY)) return;
            if (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0) return;

            // 限制人數，大於等於預期人數時阻止新氣泡生成
            const expected = expectedCountRef.current;
            if (expected > 0 && (playersRef.current.length + activeTouchesRef.current.size) >= expected) {
                return;
            }

            mouseIsDown = true;
            handleStart({
                id: MOUSE_ID,
                clientX: e.clientX,
                clientY: e.clientY,
                contactWidth: 0,
                contactHeight: 0,
                contactAngle: 0,
                source: 'mouse'
            });
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!mouseIsDown) return;
            e.preventDefault();
            const t = activeTouchesRef.current.get(MOUSE_ID);
            if (t) {
                handleMove({
                    id: MOUSE_ID,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    contactWidth: 0,
                    contactHeight: 0,
                    contactAngle: 0,
                    source: 'mouse'
                });
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (!mouseIsDown) return;
            mouseIsDown = false;
            handleEnd(MOUSE_ID);
        };

        if (supportsPointerEvents) {
            svg.addEventListener("pointerdown", onPointerDown);
            svg.addEventListener("pointermove", onPointerMove);
            svg.addEventListener("pointerup", onPointerEnd);
            svg.addEventListener("pointercancel", onPointerEnd);
        } else {
            svg.addEventListener("touchstart", onTouchStart, { passive: false });
            svg.addEventListener("touchmove", onTouchMove, { passive: false });
            svg.addEventListener("touchend", onTouchEnd, { passive: false });
            svg.addEventListener("touchcancel", onTouchCancel, { passive: false });
            svg.addEventListener("mousedown", onMouseDown);
            svg.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            isRunningRef.current = false;
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
            if (supportsPointerEvents) {
                svg.removeEventListener("pointerdown", onPointerDown);
                svg.removeEventListener("pointermove", onPointerMove);
                svg.removeEventListener("pointerup", onPointerEnd);
                svg.removeEventListener("pointercancel", onPointerEnd);
            } else {
                svg.removeEventListener("touchstart", onTouchStart);
                svg.removeEventListener("touchmove", onTouchMove);
                svg.removeEventListener("touchend", onTouchEnd);
                svg.removeEventListener("touchcancel", onTouchCancel);
                svg.removeEventListener("mousedown", onMouseDown);
                svg.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            }
            clearRendererState();
            svg.innerHTML = "";
            callbacksRef.current.onSelectorPlayersChange([]);
        };
    }, []);

    return {
        resetEngine,
        closeAllPalettes
    };
};


