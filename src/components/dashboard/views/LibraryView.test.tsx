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
    });

    it('keeps primary and secondary actions separate', () => {
        const props = makeProps();
        render(<LanguageProvider><LibraryView {...props} /></LanguageProvider>);

        fireEvent.click(screen.getByRole('button', { name: '繼續遊戲: Active Game' }));
        expect(props.onDirectResume).toHaveBeenCalledWith('active-1');

        fireEvent.click(screen.getByRole('button', { name: '刪除' }));
        expect(props.onDeleteSession).toHaveBeenCalledWith('active-1');
        expect(props.onDirectResume).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: '開始新遊戲: Pinned Game' }));
        expect(props.onTemplateSelect).toHaveBeenCalledWith(pinnedTemplate);

        fireEvent.click(screen.getByRole('button', { name: '取消釘選' }));
        expect(props.onPin).toHaveBeenCalledWith('pinned-1');
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: '複製連結' }));
        expect(props.onCopyTemplateShareLink).toHaveBeenCalledWith(pinnedTemplate, expect.any(Object));
        expect(props.onTemplateSelect).toHaveBeenCalledTimes(1);
    });
});
