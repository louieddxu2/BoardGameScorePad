import { getPlayerPaletteColors, COLOR_PALETTE_RADIUS } from './selectorHitTest';
import { drawSelectorSvg } from './selectorPainter';
import { predictColorsForPlayer } from '../../../features/recommendation/PlayerRecommendationEngine';
import { COLORS } from '../../../colors';
import type { OptionState } from './selectorEngineTypes';
import type { PlayerSelectorPhysicsOptions } from './selectorRendererTypes';

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
const LOCK_TIME_MS = 1000;
const STATIONARY_LOCK_TIME_MS = 3000;
const ANONYMOUS_MOVE_THRESHOLD = 15;

export const DEFAULT_COLOR = "#475569";

/** Capture shared refs once; no new context is allocated during animation frames. */
export function createPlayerSelectorPhysicsLoop({
    svgRef, activeTouchesRef, optionsRef, playersRef, playerVelocitiesRef, displayPositionsRef,
    optionIdCounterRef, animationFrameIdRef, isRunningRef, resultDisplayRef, allSavedPlayersRef, templateRef,
    contextVotersRef, prevWidthRef, prevHeightRef, callbacksRef,
    materializePlayer, removeOptionsForTouch, getNextAnonymousPlayerName, tapToRefreshText
}: PlayerSelectorPhysicsOptions) {
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
                                const matchedSaved = (allSavedPlayersRef.current || []).find(sp => sp.id === lockedOpt.candidate.linkedPlayerId);
                                const preferredColors = matchedSaved
                                    ? predictColorsForPlayer(matchedSaved, templateRef.current, contextVotersRef.current)
                                    : (templateRef.current?.supportedColors && templateRef.current.supportedColors.length > 0
                                        ? [...templateRef.current.supportedColors, ...COLORS.filter(c => !templateRef.current?.supportedColors?.includes(c))]
                                        : COLORS);

                                lockedOpt.candidate.suggestedColors = preferredColors;

                                const recommendedColors = getPlayerPaletteColors(
                                    preferredColors,
                                    playersRef.current,
                                    'player_' + touchId
                                );
                                lockedOpt.color = recommendedColors[0] || DEFAULT_COLOR;
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
                            color: getPlayerPaletteColors(undefined, playersRef.current, 'player_' + touchId)[0] || DEFAULT_COLOR,
                            candidate: anonymousCandidate
                        };

                        materializePlayer(touch, anonymousOption, 'COLOR_PICKING');
                        removeOptionsForTouch(touchId);
                    }
                }
            }
        });

        // 1.5 更新已物化玩家位置與旋轉角度（帶有平滑彈線效果、手指排斥力、玩家間物理互斥與邊界碰撞）
        playersRef.current.forEach(p => {
            let vel = playerVelocitiesRef.current.get(p.id);
            if (!vel) {
                vel = { vx: 0, vy: 0 };
                playerVelocitiesRef.current.set(p.id, vel);
            }

            if (p.touchId !== undefined) {
                const touch = activeTouchesRef.current.get(p.touchId) ??
                              activeTouchesRef.current.get(String(p.touchId)) ??
                              activeTouchesRef.current.get(Number(p.touchId));
                if (touch && touch.state === 'LOCKED') {
                    const lockedRadius = ORBIT_RADIUS / 2;
                    const targetX = touch.anchorX + Math.cos(touch.forwardAngleRad) * lockedRadius;
                    const targetY = touch.anchorY + Math.sin(touch.forwardAngleRad) * lockedRadius;

                    // 1. 彈簧拉力
                    vel.vx += (targetX - p.x) * (SPRING_K * 2);
                    vel.vy += (targetY - p.y) * (SPRING_K * 2);

                    // 2. 手指排斥力 (Finger Exclusion Force)，以維持手指前方距離
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

                    p.textRotationDeg = touch.textRotationDeg;
                }
            }
        });

        const isLockedOrResult = resultDisplayRef.current.isInteractionLocked ||
                                 (resultDisplayRef.current.turnOrder && resultDisplayRef.current.turnOrder.length > 0);

        // 只有在非抽籤、非結果畫面時，才計算玩家間的物理互斥 (當開啟調色盤時碰撞半徑動態變大，把周圍玩家推開)
        if (!isLockedOrResult) {
            for (let i = 0; i < playersRef.current.length; i++) {
                for (let j = i + 1; j < playersRef.current.length; j++) {
                    const p1 = playersRef.current[i];
                    const p2 = playersRef.current[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // 如果玩家開啟調色盤，碰撞半徑設為 COLOR_PALETTE_RADIUS + 10 = 74px；否則為預設 BALL_RADIUS = 26px
                    const r1 = p1.state === 'COLOR_PICKING' ? (COLOR_PALETTE_RADIUS + 10) : BALL_RADIUS;
                    const r2 = p2.state === 'COLOR_PICKING' ? (COLOR_PALETTE_RADIUS + 10) : BALL_RADIUS;
                    const minDist = r1 + r2;

                    if (dist < minDist && dist > 0.1) {
                        const force = (minDist - dist) * 0.25; // 分離係數
                        const nx = dx / dist;
                        const ny = dy / dist;

                        const v1 = playerVelocitiesRef.current.get(p1.id)!;
                        const v2 = playerVelocitiesRef.current.get(p2.id)!;

                        v1.vx += nx * force;
                        v1.vy += ny * force;
                        v2.vx -= nx * force;
                        v2.vy -= ny * force;
                    }
                }
            }
        }

        // 應用速度、邊界防護與摩擦力
        playersRef.current.forEach(p => {
            const vel = playerVelocitiesRef.current.get(p.id)!;

            // 只有在非抽籤、非結果畫面時，才套用邊界斥力，避免干擾開獎排列
            if (!isLockedOrResult) {
                if (p.x < WALL_REPULSION_DIST) vel.vx += (WALL_REPULSION_DIST - p.x) * WALL_REPULSION_FORCE;
                if (p.x > rect.width - WALL_REPULSION_DIST) vel.vx -= (p.x - (rect.width - WALL_REPULSION_DIST)) * WALL_REPULSION_FORCE;
                if (p.y < WALL_REPULSION_DIST) vel.vy += (WALL_REPULSION_DIST - p.y) * WALL_REPULSION_FORCE;
                if (p.y > rect.height - WALL_REPULSION_DIST) vel.vy -= (p.y - (rect.height - WALL_REPULSION_DIST)) * WALL_REPULSION_FORCE;
            }

            vel.vx *= FRICTION;
            vel.vy *= FRICTION;

            const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
            if (speed > MAX_NORMAL_SPEED) {
                vel.vx = (vel.vx / speed) * MAX_NORMAL_SPEED;
                vel.vy = (vel.vy / speed) * MAX_NORMAL_SPEED;
            }

            p.x += vel.vx;
            p.y += vel.vy;
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
            shouldRetreatPlayers: resultDisplayRef.current.shouldRetreatPlayers,
            tapToRefreshText
        });

        if (isRunningRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(physicsLoop);
        }
    };

    return physicsLoop;
}
