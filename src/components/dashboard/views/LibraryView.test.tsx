import React from 'react';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { GameSession, GameTemplate } from '../../../types';
import { LibraryView } from './LibraryView';
import { useDebugGestures } from '../hooks/useDebugGestures';
import { useMobileZoom } from '../../../hooks/useMobileZoom';
import { usePullAction } from '../../../hooks/usePullAction';
import { suppressInvalidTouchClick } from '../../../utils/touchGesture';
import HistoryCard from '../parts/HistoryCard';
import type { HistorySummary } from '../../../utils/extractDataSummaries';

const activeSession: GameSession = {
    id: 'session-1',
    templateId: 'active-1',
    name: 'Active Game',
    startTime: 1,
    players: [],
    status: 'active'
};

const pinnedTemplate: GameTemplate = {
    id: 'pinned-1',
    name: 'Pinned Game',
    columns: [{ id: 'score', name: 'Score', formula: 'a1', inputType: 'keypad', isScoring: true }],
    createdAt: 1
};

const recentTemplate: GameTemplate = {
    id: 'recent-1',
    name: 'Recent Game',
    columns: [],
    createdAt: 1
};

const makeProps = (): React.ComponentProps<typeof LibraryView> => ({
    activeSessions: [activeSession],
    pinnedTemplates: [pinnedTemplate],
    recentTemplates: [{ template: recentTemplate, needsResolution: true }],
    shareableTemplateIds: new Set(['pinned-1']),
    userTemplates: [],
    userTemplatesTotal: 0,
    systemTemplates: [],
    systemTemplatesTotal: 0,
    newBadgeIds: [],
    searchQuery: '',
    copiedId: null,
    isConnected: false,
    isAutoConnectEnabled: false,
    onTemplateSelect: vi.fn(),
    onRecentTemplateSelect: vi.fn(),
    onDirectResume: vi.fn(),
    onDeleteSession: vi.fn(),
    onClearAllSessions: vi.fn(),
    onPin: vi.fn(),
    onPinRecentTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onCopyJSON: vi.fn(),
    onCopyTemplateShareLink: vi.fn(),
    onCopyShareLink: vi.fn(),
    onCloudBackup: vi.fn(),
    onOpenDataManager: vi.fn(),
    onTemplateCreate: vi.fn(),
    onClearNewBadges: vi.fn(),
    onSystemCopy: vi.fn(),
    onSystemRestore: vi.fn()
});

const historyRecord: HistorySummary = {
    id: 'history-one', templateId: pinnedTemplate.id, gameName: 'History Game', endTime: 1,
    players: [], winnerIds: [], _playerNames: '', _dateStr: '', _compactDate: '', _rocDate: '',
};

const SwipeLibraryHarness: React.FC<{
    props: React.ComponentProps<typeof LibraryView>;
    onSearch?: () => void;
    onHistorySelect?: () => void;
}> = ({ props, onSearch = () => undefined, onHistorySelect = () => undefined }) => {
    useMobileZoom();
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = React.useState<'library' | 'history'>('library');
    const gestures = useDebugGestures({ viewMode, setViewMode, onTriggerInspector: vi.fn() });
    usePullAction(scrollRef, { onTriggerSearch: onSearch, onTriggerCloud: () => undefined });
    React.useEffect(() => {
        window.addEventListener('click', suppressInvalidTouchClick, true);
        return () => window.removeEventListener('click', suppressInvalidTouchClick, true);
    }, []);
    return (
        <div
            ref={scrollRef}
            data-testid="dashboard-scroll"
            onTouchStart={gestures.handleDebugTouchStart}
            onTouchMove={gestures.handleDebugTouchMove}
            onTouchEnd={gestures.handleDebugTouchEnd}
            onTouchCancel={gestures.handleDebugTouchCancel}
        >
            <LanguageProvider>{viewMode === 'library' ? <LibraryView {...props} />
                : <HistoryCard record={historyRecord} onClick={onHistorySelect} onDelete={() => undefined} />}</LanguageProvider>
            <output>{viewMode}</output>
        </div>
    );
};

describe('LibraryView compact active and pinned rows', () => {
    let previousStyle: string | null;
    let previousZoom: string | null;
    let previousLanguage: string | null;
    beforeEach(() => {
        previousStyle = document.documentElement.getAttribute('style');
        previousZoom = localStorage.getItem('app_zoom_level');
        previousLanguage = localStorage.getItem('app_language');
        localStorage.setItem('app_language', 'zh-TW');
    });
    afterEach(() => {
        cleanup();
        if (previousStyle === null) document.documentElement.removeAttribute('style');
        else document.documentElement.setAttribute('style', previousStyle);
        if (previousZoom === null) localStorage.removeItem('app_zoom_level');
        else localStorage.setItem('app_zoom_level', previousZoom);
        if (previousLanguage === null) localStorage.removeItem('app_language');
        else localStorage.setItem('app_language', previousLanguage);
    });

    it.each([{ name: 'Pinned Game', scrollTop: 0 }, { name: 'Recent Game', scrollTop: 120 }])(
        'cancels native swiping from $name before switching, then accepts the first history tap', ({ name, scrollTop }) => {
        const props = makeProps();
        const onHistorySelect = vi.fn();
        render(<SwipeLibraryHarness props={props} onHistorySelect={onHistorySelect} />);
        screen.getByTestId('dashboard-scroll').scrollTop = scrollTop;
        const button = screen.getByRole('button', { name: `開始新遊戲: ${name}` });
        const start = { identifier: 1, target: button, clientX: 120, clientY: 80 };
        const end = { ...start, clientX: 60, clientY: 82 };
        const move = createEvent.touchMove(button, { touches: [end], changedTouches: [end], cancelable: true });

        act(() => {
            fireEvent.touchStart(button, { touches: [start], targetTouches: [start] });
            fireEvent(button, move);
            fireEvent.touchEnd(button, { touches: [], changedTouches: [end] });
        });

        // Assert the native event, not React's synthetic defaultPrevented flag:
        // passive React touchmove listeners cannot cancel native panning.
        expect(move.defaultPrevented).toBe(true);
        expect(screen.getByText('history')).toBeInTheDocument();
        expect(props.onTemplateSelect).not.toHaveBeenCalled();
        expect(props.onRecentTemplateSelect).not.toHaveBeenCalled();

        const card = screen.getByText('History Game');
        const tap = { identifier: 2, target: card, clientX: 100, clientY: 100 };
        fireEvent.touchStart(card, { touches: [tap], changedTouches: [tap] });
        fireEvent.touchEnd(card, { touches: [], changedTouches: [tap] });
        fireEvent.click(card);
        expect(onHistorySelect).toHaveBeenCalledOnce();
    });

    it('accepts the existing pull-search gesture from a quick-start button without launching its game', () => {
        const props = makeProps();
        const onSearch = vi.fn();
        render(<SwipeLibraryHarness props={props} onSearch={onSearch} />);
        const button = screen.getByRole('button', { name: '開始新遊戲: Recent Game' });
        const start = { identifier: 1, target: button, clientX: 100, clientY: 80 };
        const down = { ...start, clientY: 130 };
        const right = { ...down, clientX: 140 };
        fireEvent.touchStart(button, { touches: [start], changedTouches: [start] });
        const move = createEvent.touchMove(button, { touches: [down], changedTouches: [down], cancelable: true });
        fireEvent(button, move);
        expect(move.defaultPrevented).toBe(true);
        fireEvent.touchMove(button, { touches: [right], changedTouches: [right] });
        fireEvent.touchEnd(button, { touches: [], changedTouches: [right] });
        expect(onSearch).toHaveBeenCalledOnce();
        expect(screen.getByText('library')).toBeInTheDocument();
        expect(props.onRecentTemplateSelect).not.toHaveBeenCalled();
    });

    it('uses single-column, 48px rows for active, pinned, and recent games', () => {
        const props = makeProps();
        props.userTemplates = [{ ...pinnedTemplate, id: 'user-1', name: 'Library Game' }];
        props.userTemplatesTotal = 1;
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        const activeButton = screen.getByRole('button', { name: '繼續遊戲: Active Game' });
        const pinnedButton = screen.getByRole('button', { name: '開始新遊戲: Pinned Game' });
        const recentButton = screen.getByRole('button', { name: '開始新遊戲: Recent Game' });
        expect(activeButton.parentElement).toHaveClass('h-12');
        expect(pinnedButton.parentElement).toHaveClass('h-12');
        expect(recentButton.parentElement).toHaveClass('h-12');
        // Compact rows share the dashboard's native touch policy with grid cards.
        // Per-row pan-y must not opt them into a competing native gesture.
        for (const button of [activeButton, pinnedButton, recentButton]) {
            expect(button.parentElement).not.toHaveClass('touch-pan-y');
            expect(button).not.toHaveClass('touch-pan-y');
        }
        expect(activeButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(pinnedButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(recentButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(screen.getByText('Library Game').closest('.grid')).toHaveClass('grid-cols-2');
        expect(screen.getByText('我的遊戲庫').parentElement?.parentElement).toHaveClass('min-h-10');

        const activeRow = activeButton.parentElement!;
        const pinnedRow = pinnedButton.parentElement!;
        expect(activeRow.lastElementChild).toHaveAttribute('title', '繼續遊戲');
        expect(activeRow.children[activeRow.children.length - 2]).toHaveAttribute('aria-label', '刪除');
        expect(pinnedRow.lastElementChild).toHaveAttribute('aria-label', '取消釘選');
        expect(pinnedRow.lastElementChild).toHaveClass('text-pin-fill');
        expect(pinnedRow.lastElementChild?.querySelector('svg')).toHaveClass('stroke-pin-edge');
        expect(pinnedRow.children[pinnedRow.children.length - 2]).toHaveAttribute('aria-label', '複製連結');

        const recentRow = recentButton.parentElement!;
        expect(recentRow.lastElementChild).toHaveAttribute('aria-label', '釘選');
        expect(recentRow.lastElementChild).toHaveClass('text-txt-muted', 'hover:text-pin-edge');
        expect(recentRow.querySelectorAll('svg')).toHaveLength(1);
    });

    it('shows sharing based on scoreboard type rather than pinned or recent status', () => {
        const props = makeProps();
        const simplePinnedTemplate = { ...pinnedTemplate, columns: [] };
        const fullRecentTemplate = {
            ...recentTemplate,
            // The list item is a lightweight projection; eligibility comes from its UUID lookup.
            columns: []
        };
        props.pinnedTemplates = [simplePinnedTemplate];
        props.recentTemplates = [{ template: fullRecentTemplate, needsResolution: false }];
        props.shareableTemplateIds = new Set([fullRecentTemplate.id]);
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        const pinnedRow = screen.getByRole('button', { name: '開始新遊戲: Pinned Game' }).parentElement!;
        const recentRow = screen.getByRole('button', { name: '開始新遊戲: Recent Game' }).parentElement!;
        expect(pinnedRow.querySelector('[aria-label="複製連結"]')).not.toBeInTheDocument();
        expect(recentRow.querySelector('[aria-label="複製連結"]')).toBeInTheDocument();

        fireEvent.click(recentRow.querySelector('[aria-label="複製連結"]')!);
        expect(props.onCopyTemplateShareLink).toHaveBeenCalledWith(fullRecentTemplate, expect.any(Object));
    });

    it('uses UUID eligibility for library cards whose columns were projected away', () => {
        const props = makeProps();
        props.activeSessions = [];
        props.pinnedTemplates = [];
        props.recentTemplates = [];
        props.userTemplates = [
            { ...pinnedTemplate, id: 'full-library-template', columns: [] },
            { ...recentTemplate, id: 'simple-library-template' }
        ];
        props.userTemplatesTotal = props.userTemplates.length;
        props.shareableTemplateIds = new Set(['full-library-template']);
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        expect(screen.getAllByTitle('複製連結')).toHaveLength(1);
    });

    it('keeps compact sections collapsible and clear-all available', () => {
        const props = makeProps();
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        const activeHeading = screen.getByText('進行中遊戲');
        const pinnedHeading = screen.getByText('快速開始');
        expect(activeHeading.parentElement?.parentElement).toHaveClass('min-h-9');
        expect(pinnedHeading.parentElement?.parentElement).toHaveClass('min-h-9');
        expect(activeHeading.closest('.mb-4')).toBeInTheDocument();
        expect(pinnedHeading.closest('.mb-4')).toBeInTheDocument();

        fireEvent.click(activeHeading);
        expect(screen.queryByRole('button', { name: '繼續遊戲: Active Game' })).not.toBeInTheDocument();
        fireEvent.click(activeHeading);
        expect(screen.getByRole('button', { name: '繼續遊戲: Active Game' })).toBeInTheDocument();

        fireEvent.click(pinnedHeading);
        expect(screen.queryByRole('button', { name: '開始新遊戲: Pinned Game' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '開始新遊戲: Recent Game' })).not.toBeInTheDocument();
        fireEvent.click(pinnedHeading);
        expect(screen.getByRole('button', { name: '開始新遊戲: Pinned Game' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '開始新遊戲: Recent Game' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '全部清空' }));
        expect(props.onClearAllSessions).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: '繼續遊戲: Active Game' })).toBeInTheDocument();
    });

    it('hides quick start when there are no pinned or recent games', () => {
        const props = makeProps();
        props.pinnedTemplates = [];
        props.recentTemplates = [];
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        expect(screen.queryByText('快速開始')).not.toBeInTheDocument();
    });

    it('hides quick start while searching and restores its previous collapsed state when cleared', () => {
        const props = makeProps();
        const view = (searchQuery: string) => <LanguageProvider><LibraryView {...props} searchQuery={searchQuery}
            userTemplates={searchQuery.trim() ? [pinnedTemplate] : []} /></LanguageProvider>;
        const { rerender } = render(view(''));
        expect(screen.getByRole('button', { name: '開始新遊戲: Pinned Game' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '開始新遊戲: Recent Game' })).toBeInTheDocument();

        rerender(view('Pinned'));
        expect(screen.queryByText('快速開始')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '開始新遊戲: Pinned Game' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '開始新遊戲: Recent Game' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '繼續遊戲: Active Game' })).toBeInTheDocument();
        expect(screen.getByText('Pinned Game')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '取消釘選' }).querySelector('svg')).toHaveAttribute('fill', 'currentColor');

        rerender(view(''));
        expect(screen.getByRole('button', { name: '開始新遊戲: Pinned Game' })).toBeInTheDocument();
        fireEvent.click(screen.getByText('快速開始'));
        rerender(view('Pinned'));
        expect(screen.queryByText('快速開始')).not.toBeInTheDocument();
        rerender(view(' \t '));
        expect(screen.getByText('快速開始')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '開始新遊戲: Pinned Game' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('快速開始'));
        expect(screen.getByRole('button', { name: '開始新遊戲: Recent Game' })).toBeInTheDocument();
        expect(props.onTemplateSelect).not.toHaveBeenCalled();
        expect(props.onRecentTemplateSelect).not.toHaveBeenCalled();
    });

    it('keeps primary and secondary actions separate', () => {
        const props = makeProps();
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        const activeButton = screen.getByRole('button', { name: '繼續遊戲: Active Game' });
        fireEvent.click(activeButton);
        fireEvent.click(activeButton.parentElement!);
        fireEvent.click(activeButton.parentElement!.lastElementChild!);
        expect(props.onDirectResume).toHaveBeenCalledWith('active-1');
        expect(props.onDirectResume).toHaveBeenCalledTimes(3);

        fireEvent.click(screen.getByRole('button', { name: '刪除' }));
        expect(props.onDeleteSession).toHaveBeenCalledWith('active-1');
        expect(props.onDirectResume).toHaveBeenCalledTimes(3);

        const pinnedButton = screen.getByRole('button', { name: '開始新遊戲: Pinned Game' });
        fireEvent.click(pinnedButton);
        fireEvent.click(pinnedButton.parentElement!);
        expect(props.onTemplateSelect).toHaveBeenCalledWith(pinnedTemplate);
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(2);

        fireEvent.click(screen.getByRole('button', { name: '取消釘選' }));
        expect(props.onPin).toHaveBeenCalledWith('pinned-1');
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(2);

        fireEvent.click(screen.getByRole('button', { name: '複製連結' }));
        expect(props.onCopyTemplateShareLink).toHaveBeenCalledWith(pinnedTemplate, expect.any(Object));
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(2);

        const recentButton = screen.getByRole('button', { name: '開始新遊戲: Recent Game' });
        fireEvent.click(recentButton);
        fireEvent.click(recentButton.parentElement!);
        expect(props.onRecentTemplateSelect).toHaveBeenCalledWith(props.recentTemplates[0]);
        expect(props.onRecentTemplateSelect).toHaveBeenCalledTimes(2);
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(2);

        fireEvent.click(screen.getByRole('button', { name: '釘選' }));
        expect(props.onPinRecentTemplate).toHaveBeenCalledWith(props.recentTemplates[0]);
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(2);
    });
});
