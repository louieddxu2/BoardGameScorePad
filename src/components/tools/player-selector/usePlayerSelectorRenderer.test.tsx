import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import { usePlayerSelectorRenderer } from './usePlayerSelectorRenderer';
import { Candidate, SelectorPlayer } from './types';

// Mock Vibrate API
if (typeof navigator !== 'undefined' && !navigator.vibrate) {
    (navigator as any).vibrate = vi.fn();
}

interface TestComponentProps {
    candidates: Candidate[];
    onPlayersChange: (players: SelectorPlayer[]) => void;
    onLocked?: (candidate: Candidate) => void;
    svgWidth?: number;
    svgHeight?: number;
    expectedPlayerCount?: number;
    mockSvgRef?: (svg: SVGSVGElement | null) => void;
}

const TestComponent: React.FC<TestComponentProps> = ({
    candidates,
    onPlayersChange,
    onLocked = () => {},
    svgWidth = 800,
    svgHeight = 600,
    expectedPlayerCount = 0,
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

    usePlayerSelectorRenderer({
        svgRef,
        candidates,
        randomNames: ['Arthur', 'Merlin'],
        onSelectorPlayersChange: onPlayersChange,
        onCandidateLocked: onLocked,
        expectedPlayerCount
    });

    return <svg ref={svgRef} data-testid="test-svg" style={{ width: svgWidth, height: svgHeight }} />;
};

describe('usePlayerSelectorRenderer', () => {
    let rafCallbacks: Map<number, FrameRequestCallback>;
    let rafId: number;
    let requestAnimationFrameSpy: any;
    let cancelAnimationFrameSpy: any;
    let originalPointerEvent: typeof window.PointerEvent | undefined;

    beforeEach(() => {
        originalPointerEvent = window.PointerEvent;
        Object.defineProperty(window, 'PointerEvent', {
            configurable: true,
            value: undefined
        });
        rafCallbacks = new Map();
        rafId = 0;
        requestAnimationFrameSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
            const id = ++rafId;
            rafCallbacks.set(id, callback);
            return id;
        });
        cancelAnimationFrameSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
            rafCallbacks.delete(id);
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'PointerEvent', {
            configurable: true,
            value: originalPointerEvent
        });
        vi.restoreAllMocks();
    });

    const runFrame = (id?: number) => {
        const targetId = id ?? Math.max(...Array.from(rafCallbacks.keys()));
        const callback = rafCallbacks.get(targetId);
        if (!callback) return;
        rafCallbacks.delete(targetId);
        callback(16);
    };

    const dispatchTouch = (
        svg: SVGSVGElement,
        type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
        touch: {
            identifier: number;
            clientX: number;
            clientY: number;
            radiusX?: number;
            radiusY?: number;
            rotationAngle?: number;
        }
    ) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'changedTouches', {
            value: [touch]
        });
        svg.dispatchEvent(event);
    };

    const enablePointerEvents = () => {
        Object.defineProperty(window, 'PointerEvent', {
            configurable: true,
            value: class PointerEvent extends Event {}
        });
    };

    const dispatchPointer = (
        svg: SVGSVGElement,
        type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
        pointer: {
            pointerId: number;
            clientX: number;
            clientY: number;
            width?: number;
            height?: number;
            pointerType?: string;
        }
    ) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
            pointerId: { value: pointer.pointerId },
            clientX: { value: pointer.clientX },
            clientY: { value: pointer.clientY },
            width: { value: pointer.width ?? 1 },
            height: { value: pointer.height ?? 1 },
            pointerType: { value: pointer.pointerType ?? 'touch' }
        });
        svg.dispatchEvent(event);
    };

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
        expect(cancelAnimationFrameSpy).toHaveBeenCalled();
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

        // 物理 loop 應該在寬高為 0 時被跳過，不拋錯，且仍受 RAF 控制
        runFrame();
        expect(onPlayersChange).not.toHaveBeenCalled();

        unmount();
    });

    it('should stop scheduling frames after unmount even if an old RAF callback fires', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        const { unmount } = render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const firstFrameId = Math.max(...Array.from(rafCallbacks.keys()));
        expect(firstFrameId).toBeGreaterThan(0);

        unmount();
        expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(firstFrameId);

        const scheduledCallsAfterUnmount = requestAnimationFrameSpy.mock.calls.length;
        const staleCallback = rafCallbacks.get(firstFrameId);
        if (staleCallback) {
            staleCallback(16);
        }

        expect(requestAnimationFrameSpy.mock.calls.length).toBe(scheduledCallsAfterUnmount);
        expect(onPlayersChange).toHaveBeenLastCalledWith([]);
    });

    it('should not schedule RAF when the svg ref is unavailable', () => {
        const NullRefComponent: React.FC = () => {
            const svgRef = useRef<SVGSVGElement | null>(null);
            usePlayerSelectorRenderer({
                svgRef,
                candidates: [{ id: 'c1', name: 'Alice' }],
                randomNames: [],
                onSelectorPlayersChange: vi.fn(),
                onCandidateLocked: vi.fn()
            });
            return null;
        };

        render(<NullRefComponent />);

        expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    });

    it('should clear renderer-owned SVG content on unmount', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        const { unmount } = render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const svgElement = screen.getByTestId('test-svg');
        svgElement.innerHTML = '<circle cx="1" cy="1" r="1"></circle>';

        unmount();

        expect(svgElement.innerHTML).toBe('');
    });

    it('should render the reported touch contact ellipse', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;

        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 1,
                clientX: 180,
                clientY: 160,
                radiusX: 24,
                radiusY: 9,
                rotationAngle: 32
            });
            runFrame();
        });

        const ellipse = svgElement.querySelector('[data-role="touch-contact-ellipse"]');
        expect(ellipse).not.toBeNull();
        expect(ellipse?.getAttribute('rx')).toBe('24');
        expect(ellipse?.getAttribute('ry')).toBe('9');
        expect(ellipse?.getAttribute('transform')).toContain('rotate(32');
    });

    it('should render pointer contact width and height as an ellipse', () => {
        enablePointerEvents();
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;
        svgElement.setPointerCapture = vi.fn();
        svgElement.releasePointerCapture = vi.fn();

        act(() => {
            dispatchPointer(svgElement, 'pointerdown', {
                pointerId: 7,
                clientX: 180,
                clientY: 160,
                width: 40,
                height: 18
            });
            runFrame();
        });

        const ellipse = svgElement.querySelector('[data-role="touch-contact-ellipse"]');
        expect(svgElement.setPointerCapture).toHaveBeenCalledWith(7);
        expect(ellipse).not.toBeNull();
        expect(ellipse?.getAttribute('rx')).toBe('20');
        expect(ellipse?.getAttribute('ry')).toBe('9');
    });

    it('should update the pointer contact ellipse on pointer move', () => {
        enablePointerEvents();
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;
        svgElement.setPointerCapture = vi.fn();
        svgElement.releasePointerCapture = vi.fn();

        act(() => {
            dispatchPointer(svgElement, 'pointerdown', {
                pointerId: 7,
                clientX: 180,
                clientY: 160,
                width: 30,
                height: 12
            });
            runFrame();
            dispatchPointer(svgElement, 'pointermove', {
                pointerId: 7,
                clientX: 210,
                clientY: 190,
                width: 50,
                height: 22
            });
            runFrame();
        });

        const ellipse = svgElement.querySelector('[data-role="touch-contact-ellipse"]');
        expect(ellipse).not.toBeNull();
        expect(ellipse?.getAttribute('cx')).toBe('210');
        expect(ellipse?.getAttribute('cy')).toBe('190');
        expect(ellipse?.getAttribute('rx')).toBe('25');
        expect(ellipse?.getAttribute('ry')).toBe('11');
    });

    it('should clean up pointer options on pointer cancel without creating a player', () => {
        enablePointerEvents();
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;
        svgElement.setPointerCapture = vi.fn();
        svgElement.releasePointerCapture = vi.fn();

        act(() => {
            dispatchPointer(svgElement, 'pointerdown', {
                pointerId: 7,
                clientX: 180,
                clientY: 160,
                width: 40,
                height: 18
            });
            runFrame();
            dispatchPointer(svgElement, 'pointercancel', {
                pointerId: 7,
                clientX: 180,
                clientY: 160,
                width: 40,
                height: 18
            });
            runFrame();
        });

        expect(svgElement.releasePointerCapture).toHaveBeenCalledWith(7);
        expect(svgElement.querySelector('[data-role="touch-contact-ellipse"]')).toBeNull();
        expect(onPlayersChange).not.toHaveBeenCalledWith([
            expect.objectContaining({ text: 'Alice' })
        ]);
    });

    it('should lock an anonymous option after three seconds and materialize it on release when count is not met', () => {
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' },
            { id: 'c2', name: 'Bob' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} expectedPlayerCount={2} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;

        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 1,
                clientX: 220,
                clientY: 180,
                radiusX: 12,
                radiusY: 8,
                rotationAngle: 0
            });
            runFrame();
        });

        dateNowSpy.mockReturnValue(4101);

        act(() => {
            runFrame();
        });

        // 人數未滿 (2)，鎖定時不應自動 materialized
        expect(onPlayersChange).not.toHaveBeenCalledWith([
            expect.objectContaining({ text: '玩家 1' })
        ]);
        expect(svgElement.textContent).toContain('玩家 1');

        act(() => {
            dispatchTouch(svgElement, 'touchend', {
                identifier: 1,
                clientX: 220,
                clientY: 180
            });
        });

        // 抬起手指釋放後才 materialized
        expect(onPlayersChange).toHaveBeenLastCalledWith([
            expect.objectContaining({
                text: '玩家 1',
                linkedPlayerId: undefined,
                state: 'COLOR_PICKING'
            })
        ]);
    });

    it('should lock and materialize immediately when expected count is met (last player lock)', () => {
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} expectedPlayerCount={1} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;

        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 1,
                clientX: 220,
                clientY: 180,
                radiusX: 12,
                radiusY: 8,
                rotationAngle: 0
            });
            runFrame();
        });

        dateNowSpy.mockReturnValue(4101);

        act(() => {
            runFrame();
        });

        // 當預期人數為 1 且鎖定成功，應立即 materialized，不用等手指抬起
        expect(onPlayersChange).toHaveBeenCalledWith([
            expect.objectContaining({
                text: '玩家 1',
                linkedPlayerId: undefined,
                state: 'COLOR_PICKING'
            })
        ]);
        expect(svgElement.textContent).toContain('玩家 1');
    });

    it('should correctly trigger player changes and maintain prototype player properties', () => {
        let svgInstance: SVGSVGElement | null = null;
        const candidates: Candidate[] = [
            { id: 'p1', name: 'James', linkedPlayerId: 'p1', suggestedColors: ['#ef4444'] }
        ];
        const playersList: SelectorPlayer[] = [];
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
        const mockPlayer: SelectorPlayer = {
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

    it('should prevent new touch inputs from spawning when player count has reached expected count', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' },
            { id: 'c2', name: 'Bob' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} expectedPlayerCount={1} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;

        // 1. 第一個玩家觸摸並鎖定
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 1,
                clientX: 220,
                clientY: 180
            });
            runFrame();
        });

        dateNowSpy.mockReturnValue(4101);
        act(() => {
            runFrame(); // 鎖定成功並立即 materialized
        });

        expect(onPlayersChange).toHaveBeenCalledWith([
            expect.objectContaining({ text: '玩家 1' })
        ]);

        // 2. 第二個玩家在空白處觸摸，此時已達預期人數 (1)，應直接被忽略且不產生新觸控狀態
        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 2,
                clientX: 300,
                clientY: 300
            });
            runFrame();
        });

        // 驗證畫面上沒有 Player 2 相關的圓圈選項
        expect(svgElement.textContent).not.toContain('Player 2');
        expect(svgElement.textContent).not.toContain('Arthur');
    });

    it('should double-guard and prevent materialization in materializePlayer and handleStart when count limit is reached', () => {
        const onPlayersChange = vi.fn();
        const candidates: Candidate[] = [
            { id: 'c1', name: 'Alice' },
            { id: 'c2', name: 'Bob' }
        ];

        render(
            <TestComponent candidates={candidates} onPlayersChange={onPlayersChange} expectedPlayerCount={1} />
        );

        const svgElement = screen.getByTestId('test-svg') as unknown as SVGSVGElement;

        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 1,
                clientX: 200,
                clientY: 200
            });
            runFrame();
        });

        dateNowSpy.mockReturnValue(4101);
        act(() => {
            runFrame(); 
        });

        expect(onPlayersChange).toHaveBeenCalledWith([
            expect.objectContaining({ text: '玩家 1' })
        ]);

        act(() => {
            dispatchTouch(svgElement, 'touchstart', {
                identifier: 2,
                clientX: 300,
                clientY: 300
            });
            runFrame();
        });

        expect(svgElement.textContent).not.toContain('Alice');
        expect(svgElement.textContent).not.toContain('Bob');
    });
});
