import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageContext } from '../../../i18n';
import type { GameOption, OfficialBoardLaunchStatus } from '../types';
import StartGamePanel from './StartGamePanel';

vi.mock('../../recommendation/RecommendationService', () => ({
    recommendationService: {
        getSuggestedLocations: async () => [],
        getSuggestedPlayerCounts: async () => [],
    },
}));

const localBoard: GameOption = {
    uid: 'local-board',
    templateId: 'local-board',
    displayName: 'Local Board',
    lastUsed: 1,
    usageCount: 1,
    isPinned: false,
    defaultPlayerCount: 4,
    defaultScoringRule: 'HIGHEST_WINS',
    _searchTokens: ['Local Board'],
};

function renderPanel(options: GameOption[], searchQuery: string) {
    const onStart = vi.fn();
    render(
        <LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: vi.fn() }}>
            <StartGamePanel
                options={options}
                searchQuery={searchQuery}
                isSearching
                onStart={onStart}
                onSearchClick={vi.fn()}
                onPin={vi.fn()}
            />
        </LanguageContext.Provider>
    );
    return onStart;
}

describe('StartGamePanel official scoreboard statuses', () => {
    it.each([
        ['needs_download', '需下載', '下載計分板並開始計分', 'cloud-download'],
        ['needs_connection', '需連網', '需連網才能下載計分板並開始計分', 'wifi-off'],
        ['update_available', '有新版', '嘗試更新計分板並開始計分', 'refresh-cw'],
    ] satisfies [OfficialBoardLaunchStatus, string, string, string][])(
        'shows the docked hint and start icon for %s',
        (officialBoardStatus, hint, startLabel, icon) => {
            const option: GameOption = {
                ...localBoard,
                templateId: officialBoardStatus === 'update_available' ? 'official-board' : undefined,
                officialBoardStatus,
            };
            const onStart = renderPanel([option], option.displayName);

            expect(screen.getByRole('button', { name: `${option.displayName} ${hint}` })).toBeVisible();
            const play = screen.getByRole('button', { name: startLabel });
            const [statusIcon, playIcon] = Array.from(play.querySelectorAll('svg'));
            expect(statusIcon).toHaveClass(`lucide-${icon}`);
            expect(playIcon).toHaveClass('lucide-play');
            expect(onStart).not.toHaveBeenCalled();

            fireEvent.click(play);
            if (officialBoardStatus === 'needs_connection') {
                expect(play).toBeDisabled();
                expect(onStart).not.toHaveBeenCalled();
            } else {
                expect(play).toBeEnabled();
                expect(onStart).toHaveBeenCalledOnce();
                expect(onStart.mock.calls[0][0]).toEqual(option);
            }
        }
    );

    it('shows the cloud hint only when that game is selected', () => {
        const officialBoard: GameOption = {
            ...localBoard,
            uid: 'official-board',
            templateId: undefined,
            displayName: 'Official Board',
            officialBoardStatus: 'needs_download',
        };
        const onStart = renderPanel([localBoard, officialBoard], localBoard.displayName);

        expect(screen.queryByText('需下載')).not.toBeInTheDocument();
        const play = screen.getByRole('button', { name: '開始計分' });
        expect(play.querySelectorAll('svg')).toHaveLength(1);
        fireEvent.click(play);
        expect(onStart.mock.calls[0][0]).toEqual(localBoard);

        fireEvent.click(screen.getByRole('button', { name: /^Official Board/ }));
        expect(screen.getByText('需下載')).toBeVisible();
        expect(screen.getByRole('button', { name: '下載計分板並開始計分' })).toBeEnabled();
        expect(onStart).toHaveBeenCalledOnce();
    });
});
