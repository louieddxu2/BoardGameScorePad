import React from 'react';
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { COLOR_TONES } from '../../../colors';
import appCss from '../../../index.css?raw';
import { LanguageContext } from '../../../i18n';
import type { HistoryRecord } from '../../../types';
import { getContrastTextStyles } from '../../../utils/ui';
import HistoryCard from './HistoryCard';

it('uses normal light-theme player names and scores even for winners, retaining only the shared thin edge', () => {
    const palette = Object.entries(COLOR_TONES).map(([name, tone]) => {
        const channels = appCss.match(new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+);`))!.slice(1).map(Number);
        return { name, tone, color: `rgb(${channels.join(',')})` };
    });
    const players = palette.flatMap(({ name, color }) => [false, true].map(winner => ({
        id: `${name}-${winner}`, name: `${name}-${winner}`, color, scores: {}, totalScore: 128,
    })));
    players.push(...['', 'transparent'].flatMap((color, index) => [false, true].map(winner => ({
        id: `default-${index}-${winner}`, name: `default-${index}-${winner}`, color, scores: {}, totalScore: 128,
    }))));
    const record: HistoryRecord = {
        id: 'record', templateId: 'template', gameName: 'Game', startTime: 0, endTime: 1,
        players, winnerIds: players.filter(player => player.id.endsWith('-true')).map(player => player.id),
        snapshotTemplate: { id: 'template', name: 'Game', columns: [], createdAt: 0, updatedAt: 0 },
    };
    const previousTheme = document.documentElement.getAttribute('data-theme');
    const element = () => <LanguageContext.Provider value={{ language: 'en', setLanguage: () => undefined }}>
        <HistoryCard record={record} onDelete={() => undefined} onClick={() => undefined} />
    </LanguageContext.Provider>;
    const view = render(element());
    try {
        for (const theme of ['dark', 'light', 'sage', 'dark'] as const) {
            document.documentElement.setAttribute('data-theme', theme);
            view.rerender(element());
            for (const { name, tone, color } of palette) {
                for (const winner of [false, true]) {
                    const label = view.getByText(`${name}-${winner}`);
                    const score = label.parentElement!.nextElementSibling as HTMLElement;
                    for (const ink of [label, score]) {
                        expect(ink).toHaveStyle({ color });
                        expect(ink.style.textShadow).toBe(getContrastTextStyles(color, theme).textShadow?.trim());
                        expect(ink.style.fontWeight).toBe(theme === 'dark' ? '' : '400');
                        if (theme !== 'dark') {
                            expect(ink.style.textShadow).not.toContain('rgba(255,255,255');
                            expect(ink.style.textShadow?.includes('rgba(0,0,0,0.6)')).toBe(tone === 'light');
                        }
                    }
                }
            }
            // Default ink is semantic, so it intentionally receives no inline weight override.
            // Its own name classes must therefore also avoid unconditional winner bolding.
            for (const player of players.filter(player => !player.color || player.color === 'transparent')) {
                const label = view.getByText(player.name);
                expect(label.style.color).toBe('rgb(var(--c-txt-secondary))');
                expect(label.style.fontWeight).toBe('');
                expect(label).toHaveClass('font-normal', 'dark:font-medium');
                expect(label).not.toHaveClass('font-bold', 'font-medium');
                if (player.id.endsWith('-true')) expect(label).toHaveClass('dark:font-bold');
            }
        }
    } finally {
        view.unmount();
        if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', previousTheme);
    }
});
