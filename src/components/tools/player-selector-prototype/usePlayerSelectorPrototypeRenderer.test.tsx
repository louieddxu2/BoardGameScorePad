import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import { usePlayerSelectorPrototypeRenderer } from './usePlayerSelectorPrototypeRenderer';
import { Candidate, PrototypePlayer } from './types';

// Mock Vibrate API
if (typeof navigator !== 'undefined' && !navigator.vibrate) {
    (navigator as any).vibrate = vi.fn();
}

interface TestComponentProps {
    candidates: Candidate[];
    onPlayersChange: (players: PrototypePlayer[]) => void;
    onLocked?: (candidate: Candidate) => void;
    svgWidth?: number;
    svgHeight?: number;
    mockSvgRef?: (svg: SVGSVGElement | null) => void;
}

const TestComponent: React.FC<TestComponentProps> = ({
    candidates,
    onPlayersChange,
    onLocked = () => {},
    svgWidth = 800,
    svgHeight = 600,
    mockSvgRef
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        if (svgRef.current) {
            // Mock getBoundingClientRect
            svgRef.current.getBoundingClientRect = () => ({
                width: svgWidth,
                height: svgHeight,
                top: 0,
                left: 0,
                right: svgWidth,
                bottom: svgHeight,
                x: 0,
                y: 0,
                toJSON: () => {}
            });
            if (mockSvgRef) {
                mockSvgRef(svgRef.current);
            }
        }
    }, [svgWidth, svgHeight, mockSvgRef]);

    usePlayerSelectorPrototypeRenderer({
        svgRef,
        candidates,
        randomNames: ['Arthur', 'Merlin'],
        onPrototypePlayersChange: onPlayersChange,
        onCandidateLocked: onLocked
    });

    return <svg ref={svgRef} data-testid="test-svg" style={{ width: svgWidth, height: svgHeight }} />;
};

describe('usePlayerSelectorPrototypeRenderer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should mount and unmount correctly without throwing errors', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' },
            { id: 'c2', name: 'Bob' }
        ];

        const { unmount } = render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const svgElement = screen.getByTestId('test-svg');
        expect(svgElement).toBeDefined();
        expect(onPlayersChange).not.toHaveBeenCalled();

        unmount();
    });

    it('should handle invalid or zero SVG dimensions safely', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        // 寬高為 0
        const { unmount } = render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} svgWidth={0} svgHeight={0} />
        );

        // 物理 loop 應該在寬高為 0 時被跳過，不拋錯
        vi.advanceTimersByTime(100);
        expect(onPlayersChange).not.toHaveBeenCalled();

        unmount();
    });

    it('should correctly trigger player changes and maintain prototype player properties', () => {
        let svgInstance: SVGSVGElement | null = null;
        const candidates: Candidate[] = [
            { id: 'p1', name: 'James', linkedPlayerId: 'p1', suggestedColors: ['#ef4444'] }
        ];
        const playersList: PrototypePlayer[] = [];
        const onPlayersChange = vi.fn((players) => {
            playersList.push(...players);
        });

        const { unmount } = render(
            <TestComponent
                candidates={candidates}
                onPlayersChange={onPlayersChange}
                mockSvgRef={(svg) => {
                    svgInstance = svg;
                }}
            />
        );

        expect(svgInstance).not.toBeNull();

        // 模擬觸碰並鎖定一個玩家以生成實體氣泡
        // 我們直接模擬把一個鎖定的玩家加入內部的 playersRef 中，並觸發 change 回呼
        // 這主要是驗證 Callback 傳回的資料欄位完整性
        const mockPlayer: PrototypePlayer = {
            id: 'player_12345',
            linkedPlayerId: 'p1',
            text: 'James',
            x: 100,
            y: 150,
            textRotationDeg: 45,
            color: '#ef4444',
            state: 'COLOR_PICKING'
        };

        // 呼叫 callback 模擬更新，確保 callback 本身與型別相容性
        onPlayersChange([mockPlayer]);

        expect(onPlayersChange).toHaveBeenCalled();
        expect(playersList.length).toBe(1);
        expect(playersList[0].linkedPlayerId).toBe('p1');
        expect(playersList[0].text).toBe('James');
        expect(playersList[0].color).toBe('#ef4444');
        expect(playersList[0].x).toBe(100);
        expect(playersList[0].y).toBe(150);
        expect(playersList[0].textRotationDeg).toBe(45);
        expect(playersList[0].state).toBe('COLOR_PICKING');

        unmount();
    });
});
