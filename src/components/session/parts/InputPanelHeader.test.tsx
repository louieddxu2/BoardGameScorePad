import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { Player } from '../../../types';
import InputPanelHeader from './InputPanelHeader';
import appCss from '../../../index.css?raw';
import { createColorReader } from '../../../utils/color';

it('renders valid live player-color tints without rewriting the saved player color', () => {
    const player: Player = { id: 'player', name: 'Ada', color: 'rgb(var(--c-p-emerald))', scores: {}, totalScore: 0 };
    const { container } = render(<LanguageProvider><InputPanelHeader
        player={player} isEditingPlayer onClear={vi.fn()} onDirectionToggle={vi.fn()} direction="horizontal"
    /></LanguageProvider>);
    const header = container.firstElementChild as HTMLElement;
    expect(header.style.backgroundColor).toBe('rgb(var(--c-p-emerald) / var(--player-surface-tint-opacity))');
    expect(header.style.borderColor).toBe('rgb(var(--c-p-emerald) / var(--player-surface-border-opacity))');
    expect(screen.getByText('Ada')).toHaveStyle({ color: player.color });
    expect(player.color).toBe('rgb(var(--c-p-emerald))');
});

it('preserves selected name/context colors while keeping unspecified context labels neutral on light surfaces', () => {
    const style = document.createElement('style');
    style.textContent = [...appCss.matchAll(/(?::root|html\[data-theme='(?:light|sage)'\])\s*\{[^}]*\}/g)]
        .map(match => match[0]).join('\n');
    document.head.appendChild(style);
    const previous = document.documentElement.getAttribute('data-theme');
    const player: Player = { id: 'white', name: 'Ada', color: 'rgb(var(--c-p-white))', scores: {}, totalScore: 0 };
    try {
        const renderHeader = (color?: string) => <LanguageProvider><InputPanelHeader player={player} isEditingPlayer={false}
            col={{ id: 'harvest', name: 'Harvest', inputType: 'keypad', formula: 'a1', isScoring: true, color }}
            onClear={vi.fn()} onDirectionToggle={vi.fn()} direction="horizontal" showSwipeHint />
        </LanguageProvider>;
        const { container, rerender } = render(renderHeader());
        for (const theme of ['dark', 'light', 'sage']) {
            document.documentElement.setAttribute('data-theme', theme);
            // Theme selection precedes the next session render in the application.
            rerender(renderHeader());
            const read = createColorReader();
            const label = screen.getByText(text => text.replace(/\u00ad/g, '') === 'Harvest');
            const ink = theme === 'dark' ? player.color : 'rgb(var(--c-txt-secondary))';
            expect(read(label.style.color)).toEqual(read(ink));
            const opacity = Number(getComputedStyle(document.documentElement).getPropertyValue('--input-context-opacity'));
            expect(opacity).toBe(theme === 'dark' ? 0.7 : 1);
            const name = screen.getByText('Ada');
            expect(name).toHaveStyle({ color: player.color });
            expect(name.style.fontWeight).toBe(theme === 'dark' ? '' : '400');
            expect(label.style.fontWeight).toBe('');
            expect(name.style.textShadow).not.toBe('none');
            rerender(renderHeader('#3b82f6'));
            const customLabel = screen.getByText(text => text.replace(/\u00ad/g, '') === 'Harvest');
            expect(customLabel).toHaveStyle({ color: '#3b82f6' });
            expect(customLabel.style.fontWeight).toBe(theme === 'dark' ? '' : '400');
        }
        expect(container.querySelector('.animate-swipe-hint-enter > span')).toHaveClass('text-[rgb(var(--c-input-hint-ink))]');
        expect(player.color).toBe('rgb(var(--c-p-white))');
    } finally {
        style.remove();
        if (previous === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', previous);
    }
});
