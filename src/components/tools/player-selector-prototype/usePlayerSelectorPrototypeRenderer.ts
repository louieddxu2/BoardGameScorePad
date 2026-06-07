import { useEffect, useRef } from 'react';
import { Candidate, PrototypePlayer, PrototypeTurnOrderEntry } from './types';
import {
    closePrototypePlayerPalettes,
    getAnimatedDisplayPosition,
    getBadgeTextRotation,
    getRetreatedDisplayPosition
} from './prototypeDisplay';
import { OptionState, PrototypePointerInput, TouchState } from './prototypeEngineTypes';
import { getFourCandidatesForTouch } from './prototypeCandidates';
import { applyPaletteClick, applyPlayerClick, COLOR_PALETTE_RADIUS, shouldRenderPaletteColor } from './prototypeHitTest';
import { makeSvgNode } from './prototypeSvg';

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
const STATIONARY_LOCK_TIME_MS = 3000;
const ANONYMOUS_MOVE_THRESHOLD = 15;
const ANONYMOUS_PLAYER_PREFIX = "\u73a9\u5bb6";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const DEFAULT_COLOR = "#475569";

interface UsePlayerSelectorPrototypeRendererProps {
    svgRef: React.RefObject<SVGSVGElement | null>;
    candidates: Candidate[];
    randomNames: string[];
    turnOrder?: PrototypeTurnOrderEntry[];
    highlightedPlayerId?: string | null;
    starterPlayerId?: string | null;
    shouldRetreatPlayers?: boolean;
    isInteractionLocked?: boolean;
    onPrototypePlayersChange: (players: PrototypePlayer[]) => void;
    onCandidateLocked: (candidate: Candidate) => void;
}

export const usePlayerSelectorPrototypeRenderer = ({
    svgRef,
    candidates,
    randomNames,
    turnOrder = [],
    highlightedPlayerId = null,
    starterPlayerId = null,
    shouldRetreatPlayers = false,
    isInteractionLocked = false,
    onPrototypePlayersChange,
    onCandidateLocked
}: UsePlayerSelectorPrototypeRendererProps) => {

    const activeTouchesRef = useRef<Map<string | number, TouchState>>(new Map());
    const optionsRef = useRef<OptionState[]>([]);
    const playersRef = useRef<PrototypePlayer[]>([]);
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
        displayPositionsRef.current.clear();
        optionIdCounterRef.current = 0;
        prevWidthRef.current = 0;
        prevHeightRef.current = 0;

        const svg = svgRef.current;
        if (svg) {
            svg.innerHTML = "";
        }
    };

    const spawnOptionsForTouch = (touchId: string | number, x: number, y: number) => {
        const selectedCandidates = getFourCandidatesForTouch(
            candidates,
            optionsRef.current,
            playersRef.current,
            randomNames,
            (name) => `fallback_${name}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            (index) => `temp_${index}_${Date.now()}`
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

    const materializePlayer = (touch: TouchState, option: OptionState) => {
        playersRef.current.push({
            id: 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            linkedPlayerId: option.candidate.linkedPlayerId,
            x: option.x + (touch.anchorX - option.x) / 2,
            y: option.y + (touch.anchorY - option.y) / 2,
            textRotationDeg: touch.textRotationDeg,
            text: option.text,
            color: option.color,
            state: 'COLOR_PICKING'
        });
        onPrototypePlayersChange([...playersRef.current]);
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

        activeTouchesRef.current.forEach((touch, touchId) => {
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            touch.canvasX = x;
            touch.canvasY = y;

            touch.anchorX = (touch.state === 'LOCKED') ? touch.canvasX : touch.startX;
            touch.anchorY = (touch.state === 'LOCKED') ? touch.canvasY : touch.startY;

            const vecOutX = touch.canvasX - cx;
            const vecOutY = touch.canvasY - cy;
            const outDist = Math.sqrt(vecOutX * vecOutX + vecOutY * vecOutY);
            const normOutX = outDist > 0 ? vecOutX / outDist : 0;
            const normOutY = outDist > 0 ? vecOutY / outDist : 1;

            let humanDirX = normOutX;
            let humanDirY = normOutY;
            const edgeProximity = Math.min(outDist / maxPossibleDist, 1.0);
            const distanceTrustMultiplier = 1.0 - edgeProximity;

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
                    const finalEllipseTrust = Math.min((ratio - 1.1) * 1.5, 0.85) * distanceTrustMultiplier;
                    humanDirX = ellipseDirX * finalEllipseTrust + normOutX * (1 - finalEllipseTrust);
                    humanDirY = ellipseDirY * finalEllipseTrust + normOutY * (1 - finalEllipseTrust);
                }
            }

            const humanLen = Math.sqrt(humanDirX * humanDirX + humanDirY * humanDirY) || 1;
            touch.humanAngleRad = Math.atan2(humanDirY / humanLen, humanDirX / humanLen);
            touch.forwardAngleRad = touch.humanAngleRad + Math.PI;
            touch.textRotationDeg = (touch.humanAngleRad * 180 / Math.PI) - 90;

            const timeAlive = now - touch.spawnTime;

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

                    const angleOffsets = [-Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2];
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
                                onCandidateLocked(lockedOpt.candidate);
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

                        optionsRef.current = optionsRef.current.filter(o => o.touchId !== touchId);
                        optionsRef.current.push(anonymousOption);
                    }
                }
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
                    const angleOffsets = [-Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2];
                    const targetAngle = touch.forwardAngleRad + angleOffsets[opt.idx];
                    const targetX = touch.anchorX + Math.cos(targetAngle) * ORBIT_RADIUS;
                    const targetY = touch.anchorY + Math.sin(targetAngle) * ORBIT_RADIUS;
                    opt.vx += (targetX - opt.x) * SPRING_K;
                    opt.vy += (targetY - opt.y) * SPRING_K;
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

        svg.innerHTML = "";

        const renderedPlayerIds = new Set<string>();
        playersRef.current.forEach(p => {
            renderedPlayerIds.add(p.id);
            const rotation = p.textRotationDeg;
            const display = resultDisplayRef.current;
            const targetDisplayPosition = getRetreatedDisplayPosition(p, rect, display.shouldRetreatPlayers);
            const displayPosition = getAnimatedDisplayPosition(
                p,
                targetDisplayPosition,
                displayPositionsRef.current.get(p.id),
                display.shouldRetreatPlayers
            );
            displayPositionsRef.current.set(p.id, displayPosition);
            const group = makeSvgNode("g", { transform: `translate(${displayPosition.x}, ${displayPosition.y}) rotate(${rotation})` });
            const turnOrderEntry = display.turnOrder.find(entry => entry.prototypePlayerId === p.id);
            const isHighlighted = display.highlightedPlayerId === p.id;
            const isStarter = display.starterPlayerId === p.id;
            const teamStroke = turnOrderEntry
                ? (turnOrderEntry.order % 2 === 1 ? "#3b82f6" : "#f97316")
                : null;

            const boxW = 86;
            const boxH = 34;

            if (isHighlighted) {
                svg.appendChild(makeSvgNode("circle", {
                    cx: displayPosition.x,
                    cy: displayPosition.y,
                    r: 68,
                    fill: "rgba(168,85,247,0.12)",
                    stroke: "#a855f7",
                    "stroke-width": 4
                }));
            }

            if (turnOrderEntry && teamStroke) {
                svg.appendChild(makeSvgNode("circle", {
                    cx: displayPosition.x,
                    cy: displayPosition.y,
                    r: 54,
                    fill: "none",
                    stroke: teamStroke,
                    "stroke-width": isStarter ? 5 : 3,
                    "stroke-dasharray": isStarter ? "none" : "8 5"
                }));
            }

            if (p.state === 'COLOR_PICKING') {
                group.appendChild(makeSvgNode("circle", {
                    cx: 0,
                    cy: 0,
                    r: COLOR_PALETTE_RADIUS,
                    fill: "rgba(15,23,42,0.6)",
                    stroke: "#334155",
                    "stroke-width": 1
                }));

                PALETTE.forEach((color, i) => {
                    if (!shouldRenderPaletteColor(i)) return;

                    const angle = (i * 45) * Math.PI / 180;
                    const dotX = Math.cos(angle) * COLOR_PALETTE_RADIUS;
                    const dotY = Math.sin(angle) * COLOR_PALETTE_RADIUS;
                    const isSelected = (p.color === color);

                    group.appendChild(makeSvgNode("circle", {
                        cx: dotX,
                        cy: dotY,
                        r: 16,
                        fill: color,
                        stroke: isSelected ? "#ffffff" : "#475569",
                        "stroke-width": isSelected ? 3 : 1
                    }));
                });
            }

            group.appendChild(makeSvgNode("rect", {
                x: -boxW / 2,
                y: -boxH / 2,
                width: boxW,
                height: boxH,
                rx: boxH / 2,
                fill: p.color,
                stroke: "#0f172a",
                "stroke-width": 3
            }));

            const textNode = makeSvgNode("text", {
                x: 0,
                y: 1,
                fill: "#ffffff",
                "font-size": "15px",
                "font-weight": "bold",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                "pointer-events": "none"
            });
            textNode.textContent = p.text;
            group.appendChild(textNode);

            if (turnOrderEntry) {
                const badgePositions = [
                    { x: 0, y: -35, screenRotation: 180 },
                    { x: 52, y: 0, screenRotation: 90 },
                    { x: 0, y: 35, screenRotation: 0 },
                    { x: -52, y: 0, screenRotation: -90 }
                ];
                badgePositions.forEach(({ x, y, screenRotation }) => {
                    group.appendChild(makeSvgNode("circle", {
                        cx: x,
                        cy: y,
                        r: 11,
                        fill: "#0f172a",
                        stroke: teamStroke || "#64748b",
                        "stroke-width": 2
                    }));
                    const badgeText = makeSvgNode("text", {
                        x,
                        y: y + 1,
                        fill: "#ffffff",
                        "font-size": "11px",
                        "font-weight": "bold",
                        "text-anchor": "middle",
                        "dominant-baseline": "middle",
                        transform: `rotate(${getBadgeTextRotation(rotation, screenRotation)} ${x} ${y})`,
                        "pointer-events": "none"
                    });
                    badgeText.textContent = String(turnOrderEntry.order);
                    group.appendChild(badgeText);
                });
            }

            if (isStarter) {
                const starterText = makeSvgNode("text", {
                    x: 0,
                    y: -54,
                    fill: "#facc15",
                    "font-size": "20px",
                    "font-weight": "bold",
                    "text-anchor": "middle",
                    "dominant-baseline": "middle",
                    "pointer-events": "none"
                });
                starterText.textContent = "◎";
                group.appendChild(starterText);
            }

            if (p.state === 'COLOR_PICKING') {
                const deleteGroup = makeSvgNode("g", { transform: "translate(0, -42)" });
                deleteGroup.appendChild(makeSvgNode("rect", {
                    x: -22,
                    y: -9,
                    width: 44,
                    height: 18,
                    rx: 9,
                    fill: "#ef4444",
                    stroke: "#0f172a",
                    "stroke-width": 2
                }));

                const deleteText = makeSvgNode("text", {
                    x: 0,
                    y: 1,
                    fill: "#ffffff",
                    "font-size": "12px",
                    "font-weight": "bold",
                    "text-anchor": "middle",
                    "dominant-baseline": "middle",
                    "pointer-events": "none"
                });
                deleteText.textContent = "×";
                deleteGroup.appendChild(deleteText);
                group.appendChild(deleteGroup);
            }

            svg.appendChild(group);
        });
        displayPositionsRef.current.forEach((_, playerId) => {
            if (!renderedPlayerIds.has(playerId)) {
                displayPositionsRef.current.delete(playerId);
            }
        });

        activeTouchesRef.current.forEach((touch) => {
            const fVecX = touch.anchorX - cx;
            const fVecY = touch.anchorY - cy;
            const fLen = Math.sqrt(fVecX * fVecX + fVecY * fVecY);
            if (fLen > 0.1) {
                const nx = fVecX / fLen;
                const ny = fVecY / fLen;
                const dirX = -ny;
                const dirY = nx;

                const maxLen = Math.max(rect.width, rect.height);
                const lX1 = cx - dirX * maxLen;
                const lY1 = cy - dirY * maxLen;
                const lX2 = cx + dirX * maxLen;
                const lY2 = cy + dirY * maxLen;
                svg.appendChild(makeSvgNode("line", {
                    x1: lX1,
                    y1: lY1,
                    x2: lX2,
                    y2: lY2,
                    stroke: "rgba(255,255,255,0.2)",
                    "stroke-width": 2,
                    "stroke-dasharray": "8 8"
                }));
            }

            const arcR = ORBIT_RADIUS + BALL_RADIUS;
            const a1 = touch.humanAngleRad - Math.PI / 3;
            const a2 = touch.humanAngleRad + Math.PI / 3;

            const p1x = touch.anchorX + Math.cos(a1) * arcR;
            const p1y = touch.anchorY + Math.sin(a1) * arcR;
            const p2x = touch.anchorX + Math.cos(a2) * arcR;
            const p2y = touch.anchorY + Math.sin(a2) * arcR;

            const pathData = `M ${touch.anchorX} ${touch.anchorY} L ${p1x} ${p1y} A ${arcR} ${arcR} 0 0 1 ${p2x} ${p2y} Z`;
            svg.appendChild(makeSvgNode("path", {
                d: pathData,
                fill: "rgba(239, 68, 68, 0.05)",
                stroke: "rgba(239, 68, 68, 0.2)",
                "stroke-width": 1,
                "stroke-dasharray": "4 4"
            }));

            const fx = touch.anchorX + Math.cos(touch.forwardAngleRad) * arcR;
            const fy = touch.anchorY + Math.sin(touch.forwardAngleRad) * arcR;
            svg.appendChild(makeSvgNode("line", {
                x1: touch.anchorX,
                y1: touch.anchorY,
                x2: fx,
                y2: fy,
                stroke: "rgba(59, 130, 246, 0.3)",
                "stroke-width": 2,
                "stroke-dasharray": "4 4"
            }));

            if (touch.radiusX > 0 && touch.radiusY > 0) {
                svg.appendChild(makeSvgNode("ellipse", {
                    "data-role": "touch-contact-ellipse",
                    cx: touch.canvasX,
                    cy: touch.canvasY,
                    rx: Math.max(touch.radiusX, 8),
                    ry: Math.max(touch.radiusY, 8),
                    transform: `rotate(${touch.rotationAngle} ${touch.canvasX} ${touch.canvasY})`,
                    fill: "rgba(168, 85, 247, 0.16)",
                    stroke: "rgba(216, 180, 254, 0.85)",
                    "stroke-width": 2,
                    "pointer-events": "none"
                }));
            }

            // 簡化版驗證：基於 1px 微位移軌跡繪製的「預測手指方向橢圓」
            const moveDx = touch.canvasX - touch.startX;
            const moveDy = touch.canvasY - touch.startY;
            const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
            if (moveDist > 1) {
                const microSwipeAngleDeg = Math.atan2(moveDy, moveDx) * 180 / Math.PI;
                svg.appendChild(makeSvgNode("ellipse", {
                    "data-role": "micro-swipe-predicted-ellipse",
                    cx: touch.canvasX,
                    cy: touch.canvasY,
                    rx: 35, // 長軸
                    ry: 12, // 短軸
                    transform: `rotate(${microSwipeAngleDeg} ${touch.canvasX} ${touch.canvasY})`,
                    fill: "rgba(249, 115, 22, 0.25)", // 半透明橘色
                    stroke: "rgba(251, 146, 60, 0.9)", // 橘色邊框
                    "stroke-width": 2,
                    "pointer-events": "none"
                }));
            }


            if (touch.state === 'CHOOSING') {
                svg.appendChild(makeSvgNode("circle", {
                    cx: touch.anchorX,
                    cy: touch.anchorY,
                    r: 30,
                    fill: "rgba(255,255,255,0.05)",
                    stroke: "#475569",
                    "stroke-width": 2
                }));
                if (touch.selectedOptionId === null && touch.progress > 0) {
                    const r = 34;
                    const circumference = 2 * Math.PI * r;
                    const offset = circumference * (1 - Math.min(touch.progress, 1));
                    svg.appendChild(makeSvgNode("circle", {
                        cx: touch.anchorX,
                        cy: touch.anchorY,
                        r,
                        fill: "none",
                        stroke: "#a855f7",
                        "stroke-width": 4,
                        "stroke-dasharray": circumference,
                        "stroke-dashoffset": offset,
                        transform: `rotate(-90 ${touch.anchorX} ${touch.anchorY})`
                    }));
                }
                svg.appendChild(makeSvgNode("line", {
                    x1: touch.anchorX,
                    y1: touch.anchorY,
                    x2: touch.canvasX,
                    y2: touch.canvasY,
                    stroke: "#a855f7",
                    "stroke-width": 4,
                    "stroke-linecap": "round"
                }));
                svg.appendChild(makeSvgNode("circle", {
                    cx: touch.canvasX,
                    cy: touch.canvasY,
                    r: 12,
                    fill: "#a855f7"
                }));
            } else if (touch.state === 'LOCKED') {
                const pulse = (now % 1000) / 1000;
                const pulseR = 40 + pulse * 40;
                const pulseAlpha = 1 - pulse;

                svg.appendChild(makeSvgNode("circle", {
                    cx: touch.canvasX,
                    cy: touch.canvasY,
                    r: pulseR,
                    fill: "none",
                    stroke: `rgba(168, 85, 247, ${pulseAlpha})`,
                    "stroke-width": 3
                }));
                svg.appendChild(makeSvgNode("circle", {
                    cx: touch.canvasX,
                    cy: touch.canvasY,
                    r: 35,
                    fill: "none",
                    stroke: "rgba(168, 85, 247, 0.5)",
                    "stroke-width": 2,
                    "stroke-dasharray": "6 6"
                }));
                svg.appendChild(makeSvgNode("circle", {
                    cx: touch.canvasX,
                    cy: touch.canvasY,
                    r: 4,
                    fill: "#a855f7"
                }));
            }
        });

        optionsRef.current.forEach(opt => {
            const touch = activeTouchesRef.current.get(opt.touchId);
            if (!touch) return;

            const isSelected = (touch.state === 'CHOOSING' && touch.selectedOptionId === opt.id);
            const boxW = 86;
            const boxH = 34;

            const group = makeSvgNode("g", {
                transform: `translate(${opt.x}, ${opt.y}) rotate(${touch.textRotationDeg})`
            });

            if (isSelected) {
                const r = 52;
                const circumference = 2 * Math.PI * r;
                const offset = circumference * (1 - touch.progress);
                group.appendChild(makeSvgNode("circle", {
                    cx: 0,
                    cy: 0,
                    r: r,
                    fill: "none",
                    stroke: "rgba(255,255,255,0.1)",
                    "stroke-width": 6
                }));
                group.appendChild(makeSvgNode("circle", {
                    cx: 0,
                    cy: 0,
                    r: r,
                    fill: "none",
                    stroke: "#a855f7",
                    "stroke-width": 6,
                    "stroke-dasharray": circumference,
                    "stroke-dashoffset": offset,
                    transform: "rotate(-90)"
                }));
            }

            const scale = isSelected ? 'scale(1.15)' : 'scale(1.0)';
            const innerGroup = makeSvgNode("g", {
                transform: scale,
                style: "transition: transform 0.1s"
            });

            innerGroup.appendChild(makeSvgNode("rect", {
                x: -boxW / 2,
                y: -boxH / 2,
                width: boxW,
                height: boxH,
                rx: boxH / 2,
                fill: opt.color,
                stroke: isSelected ? "#a855f7" : "#0f172a",
                "stroke-width": isSelected ? 4 : 3
            }));

            const textNode = makeSvgNode("text", {
                x: 0,
                y: 1,
                fill: "#ffffff",
                "font-size": "15px",
                "font-weight": "bold",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                "pointer-events": "none"
            });
            textNode.textContent = opt.text;
            innerGroup.appendChild(textNode);

            group.appendChild(innerGroup);
            svg.appendChild(group);
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
        onPrototypePlayersChange([...playersRef.current]);
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
        onPrototypePlayersChange([...playersRef.current]);
        return true;

    };

    const handleStart = (input: PrototypePointerInput) => {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const canvasX = input.clientX - rect.left;
        const canvasY = input.clientY - rect.top;

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
            textRotationDeg: 0
        });

        spawnOptionsForTouch(input.id, canvasX, canvasY);
    };

    const handleMove = (input: PrototypePointerInput) => {
        const touch = activeTouchesRef.current.get(input.id);
        if (!touch) return;

        touch.clientX = input.clientX;
        touch.clientY = input.clientY;
        touch.radiusX = input.contactWidth / 2;
        touch.radiusY = input.contactHeight / 2;
        touch.rotationAngle = input.contactAngle;
    };

    const getTouchInput = (touch: Touch): PrototypePointerInput => ({
        id: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
        contactWidth: (touch.radiusX || 0) * 2,
        contactHeight: (touch.radiusY || 0) * 2,
        contactAngle: touch.rotationAngle || 0,
        source: 'touch'
    });

    const getPointerInput = (event: PointerEvent): PrototypePointerInput => {
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
            const finalOpt = optionsRef.current.find(o => o.touchId === id);
            if (finalOpt) {
                materializePlayer(touch, finalOpt);
            }
        }
        activeTouchesRef.current.delete(id);
        removeOptionsForTouch(id);
    };

    const closeAllPalettes = () => {
        const nextPlayers = closePrototypePlayerPalettes(playersRef.current);
        playersRef.current = nextPlayers;
        onPrototypePlayersChange([...playersRef.current]);
    };

    const resetEngine = () => {
        clearRendererState();
        onPrototypePlayersChange([]);
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
            onPrototypePlayersChange([]);
        };
    }, [candidates]);

    return {
        resetEngine,
        closeAllPalettes
    };
};


