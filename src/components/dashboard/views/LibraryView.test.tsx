import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { GameSession, GameTemplate } from '../../../types';
import { LibraryView } from './LibraryView';
import { useDebugGestures } from '../hooks/useDebugGestures';

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

const SwipeLibraryHarness: React.FC<{ props: React.ComponentProps<typeof LibraryView> }> = ({ props }) => {
    const [viewMode, setViewMode] = React.useState<'library' | 'history'>('library');
    const gestures = useDebugGestures({ viewMode, setViewMode, onTriggerInspector: vi.fn() });
    return (
        <div
            onTouchStart={gestures.handleDebugTouchStart}
            onTouchMove={gestures.handleDebugTouchMove}
            onTouchEnd={gestures.handleDebugTouchEnd}
        >
            <LanguageProvider><LibraryView {...props} /></LanguageProvider>
            <output>{viewMode}</output>
        </div>
    );
};

describe('LibraryView compact active and pinned rows', () => {
    beforeEach(() => localStorage.setItem('app_language', 'zh-TW'));

    it.each(['Pinned Game', 'Recent Game'])('switches to history on a quick swipe from %s', name => {
        const props = makeProps();
        render(<SwipeLibraryHarness props={props} />);
        const button = screen.getByRole('button', { name: `開始新遊戲: ${name}` });
        const start = { clientX: 120, clientY: 80 };
        const end = { clientX: 60, clientY: 80 };

        act(() => {
            fireEvent.touchStart(button, { touches: [start], targetTouches: [start] });
            fireEvent.touchMove(button, { touches: [end], targetTouches: [end] });
            fireEvent.touchEnd(button, { changedTouches: [end] });
        });

        expect(screen.getByText('history')).toBeInTheDocument();
        expect(props.onTemplateSelect).not.toHaveBeenCalled();
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
        expect(activeButton.parentElement).toHaveClass('touch-pan-y');
        expect(pinnedButton.parentElement).toHaveClass('touch-pan-y');
        expect(recentButton.parentElement).toHaveClass('touch-pan-y');
        expect(activeButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(pinnedButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(recentButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(screen.getByText('Library Game').closest('.grid')).toHaveClass('grid-cols-2');
        expect(screen.getByText('我的遊戲庫').parentElement?.parentElement).toHaveClass('p-2.5');

        const activeRow = activeButton.parentElement!;
        const pinnedRow = pinnedButton.parentElement!;
        expect(activeRow.lastElementChild).toHaveAttribute('title', '繼續遊戲');
        expect(activeRow.children[activeRow.children.length - 2]).toHaveAttribute('aria-label', '刪除');
        expect(pinnedRow.lastElementChild).toHaveAttribute('aria-label', '取消釘選');
        expect(pinnedRow.children[pinnedRow.children.length - 2]).toHaveAttribute('aria-label', '複製連結');

        const recentRow = recentButton.parentElement!;
        expect(recentRow.lastElementChild).toHaveAttribute('aria-label', '釘選');
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
