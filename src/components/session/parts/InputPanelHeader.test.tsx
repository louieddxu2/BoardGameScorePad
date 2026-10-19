import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { Player } from '../../../types';
import InputPanelHeader from './InputPanelHeader';

it('renders valid live player-color tints without rewriting the saved player color', () => {
    const player: Player = { id: 'player', name: 'Ada', color: 'rgb(var(--c-p-emerald))', scores: {}, totalScore: 0 };
    const { container } = render(<LanguageProvider><InputPanelHeader
        player={player} isEditingPlayer onClear={vi.fn()} onDirectionToggle={vi.fn()} direction="horizontal"
    /></LanguageProvider>);
    const header = container.firstElementChild as HTMLElement;
    expect(header.style.backgroundColor).toBe('rgb(var(--c-p-emerald) / 0.12549)');
    expect(header.style.borderColor).toBe('rgb(var(--c-p-emerald) / 0.25098)');
    expect(screen.getByText('Ada')).toHaveStyle({ color: player.color });
    expect(player.color).toBe('rgb(var(--c-p-emerald))');
});
