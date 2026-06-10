import { SelectorPlayer, SelectorTurnOrderEntry } from './types';
import { OptionState, TouchState } from './selectorEngineTypes';
import { makeSvgNode } from './selectorSvg';
import {
    getAnimatedDisplayPosition,
    getRetreatedDisplayPosition
} from './selectorDisplay';
import { COLOR_PALETTE_RADIUS, shouldRenderPaletteColor } from './selectorHitTest';

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const ORBIT_RADIUS = 110;
const BALL_RADIUS = 26;

const calculateResponsiveFontSize = (text: string, baseSize = 19): string => {
    let totalWeight = 0;
    for (let i = 0; i < text.length; i++) {
        // 全形/中文字元權重為 1.0，半形/英文字元權重為 0.52
        totalWeight += text.charCodeAt(i) > 255 ? 1.0 : 0.52;
    }
    // 中文 4 字 (4.0) 與英文 8 字 (4.16) 為最大字型臨界點。
    // 超過 4.16 時開始進行等比例縮小，最低不小於 11px
    if (totalWeight > 4.16) {
        const shrunkSize = Math.max(11, (baseSize * 4.16) / totalWeight);
        return `${shrunkSize.toFixed(1)}px`;
    }
    return `${baseSize}px`;
};

interface DrawSelectorSvgProps {
    svg: SVGSVGElement;
    rect: DOMRect;
    players: SelectorPlayer[];
    options: OptionState[];
    activeTouches: Map<string | number, TouchState>;
    displayPositions: Map<string, { x: number; y: number }>;
    turnOrder: SelectorTurnOrderEntry[];
    highlightedPlayerId: string | null;
    starterPlayerId: string | null;
    shouldRetreatPlayers: boolean;
}

export const drawSelectorSvg = ({
    svg,
    rect,
    players,
    options,
    activeTouches,
    displayPositions,
    turnOrder,
    highlightedPlayerId,
    starterPlayerId,
    shouldRetreatPlayers
}: DrawSelectorSvgProps) => {
    svg.innerHTML = "";

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const now = Date.now();

    // 繪製中央大橢圓視覺底圖 (對稱且 pointer-events: none)
    const ellipseRx = rect.width * 0.32;
    const ellipseRy = rect.height * 0.21;
    svg.appendChild(makeSvgNode("ellipse", {
        cx: cx,
        cy: cy,
        rx: ellipseRx,
        ry: ellipseRy,
        fill: "none",
        stroke: "rgba(255, 255, 255, 0.12)",
        "stroke-width": 2,
        "stroke-dasharray": "6 4",
        "pointer-events": "none"
    }));

    const renderedPlayerIds = new Set<string>();
    players.forEach(p => {
        renderedPlayerIds.add(p.id);
        const rotation = p.textRotationDeg;
        const targetDisplayPosition = getRetreatedDisplayPosition(p, rect, shouldRetreatPlayers);
        const displayPosition = getAnimatedDisplayPosition(
            p,
            targetDisplayPosition,
            displayPositions.get(p.id),
            shouldRetreatPlayers
        );
        displayPositions.set(p.id, displayPosition);
        
        const touch = p.touchId !== undefined ? (
            activeTouches.get(p.touchId) ??
            activeTouches.get(String(p.touchId)) ??
            activeTouches.get(Number(p.touchId))
        ) : undefined;
        const isCurrentlyHeldAndLocked = touch && touch.state === 'LOCKED';

        const group = makeSvgNode("g", { transform: `translate(${displayPosition.x}, ${displayPosition.y}) rotate(${rotation})` });
        const turnOrderEntry = turnOrder.find(entry => entry.prototypePlayerId === p.id);
        const isHighlighted = highlightedPlayerId === p.id;
        const isStarter = starterPlayerId === p.id;
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
            "font-size": calculateResponsiveFontSize(p.text),
            "font-weight": "bold",
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            "pointer-events": "none"
        });
        textNode.textContent = p.text;
        group.appendChild(textNode);

        if (turnOrderEntry) {
            const badgePositions = [
                { x: 0, y: -35, localRotation: 180 },
                { x: 52, y: 0, localRotation: 90 },
                { x: 0, y: 35, localRotation: 0 },
                { x: -52, y: 0, localRotation: -90 }
            ];
            badgePositions.forEach(({ x, y, localRotation }) => {
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
                    transform: `rotate(${localRotation} ${x} ${y})`,
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

        if (isCurrentlyHeldAndLocked) {
            [0, 0.5].forEach(offset => {
                const pulse = ((now % 1000) / 1000 + offset) % 1;
                const pulseR = 76 + pulse * 34;
                const pulseAlpha = 0.8 * (1 - pulse);
                svg.appendChild(makeSvgNode("circle", {
                    cx: displayPosition.x,
                    cy: displayPosition.y,
                    r: pulseR,
                    fill: "none",
                    stroke: p.color,
                    "stroke-width": 2.5,
                    opacity: pulseAlpha,
                    "pointer-events": "none"
                }));
            });
        }
    });

    displayPositions.forEach((_, playerId) => {
        if (!renderedPlayerIds.has(playerId)) {
            displayPositions.delete(playerId);
        }
    });

    activeTouches.forEach((touch) => {
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

        if (touch.hasDisplayEllipse && touch.displayRx !== undefined && touch.displayRy !== undefined && touch.displayAngle !== undefined) {
            svg.appendChild(makeSvgNode("ellipse", {
                "data-role": "touch-contact-ellipse",
                cx: touch.canvasX,
                cy: touch.canvasY,
                rx: Math.max(touch.displayRx, 8),
                ry: Math.max(touch.displayRy, 8),
                transform: `rotate(${touch.displayAngle} ${touch.canvasX} ${touch.canvasY})`,
                fill: "rgba(168, 85, 247, 0.16)",
                stroke: "rgba(216, 180, 254, 0.85)",
                "stroke-width": 2,
                "pointer-events": "none"
            }));
        }

        if (touch.state === 'CHOOSING') {
            svg.appendChild(makeSvgNode("circle", {
                cx: touch.anchorX,
                cy: touch.anchorY,
                r: 42,
                fill: "rgba(255,255,255,0.05)",
                stroke: "#475569",
                "stroke-width": 2
            }));
            if (touch.selectedOptionId === null && touch.progress > 0) {
                const r = 46;
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

    options.forEach(opt => {
        const touch = activeTouches.get(opt.touchId);
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
            "font-size": calculateResponsiveFontSize(opt.text),
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
};
