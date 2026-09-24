import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { GameSession, GameTemplate } from '../../../types';
import { LibraryView } from './LibraryView';

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
    columns: [],
    createdAt: 1
};

const makeProps = (): React.ComponentProps<typeof LibraryView> => ({
    activeSessions: [activeSession],
    pinnedTemplates: [pinnedTemplate],
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
    onDirectResume: vi.fn(),
    onDeleteSession: vi.fn(),
    onClearAllSessions: vi.fn(),
    onPin: vi.fn(),
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

describe('LibraryView compact active and pinned rows', () => {
    beforeEach(() => localStorage.setItem('app_language', 'zh-TW'));

    it('uses single-column, 48px rows only for active and pinned games', () => {
        const props = makeProps();
        props.userTemplates = [{ ...pinnedTemplate, id: 'user-1', name: 'Library Game' }];
        props.userTemplatesTotal = 1;
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        const activeButton = screen.getByRole('button', { name: '繼續遊戲: Active Game' });
        const pinnedButton = screen.getByRole('button', { name: '開始新遊戲: Pinned Game' });
        expect(activeButton.parentElement).toHaveClass('h-12');
        expect(pinnedButton.parentElement).toHaveClass('h-12');
        expect(activeButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(pinnedButton.closest('.grid')).toHaveClass('grid-cols-1');
        expect(screen.getByText('Library Game').closest('.grid')).toHaveClass('grid-cols-2');
        expect(screen.getByText('我的遊戲庫').parentElement?.parentElement).toHaveClass('p-2.5');

        const activeRow = activeButton.parentElement!;
        const pinnedRow = pinnedButton.parentElement!;
        expect(activeRow.lastElementChild).toHaveAttribute('title', '繼續遊戲');
        expect(activeRow.children[activeRow.children.length - 2]).toHaveAttribute('aria-label', '刪除');
        expect(pinnedRow.lastElementChild).toHaveAttribute('aria-label', '取消釘選');
        expect(pinnedRow.children[pinnedRow.children.length - 2]).toHaveAttribute('aria-label', '複製連結');
    });

    it('keeps compact sections collapsible and clear-all available', () => {
        const props = makeProps();
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        const activeHeading = screen.getByText('進行中遊戲');
        const pinnedHeading = screen.getByText('已釘選');
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
        fireEvent.click(pinnedHeading);
        expect(screen.getByRole('button', { name: '開始新遊戲: Pinned Game' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '全部清空' }));
        expect(props.onClearAllSessions).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: '繼續遊戲: Active Game' })).toBeInTheDocument();
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
    });
});
