import React, { createRef } from 'react';
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { GameSession, GameTemplate } from '../../../types';
import { createColorReader } from '../../../utils/color';
import { contrastOnBackground } from '../../../utils/colorContrast';
import appCss from '../../../index.css?raw';
import ScoreGrid from './ScoreGrid';

it('updates mounted player tints and keeps light auto rows continuous with their labels without remounting', () => {
    const style = document.createElement('style');
    style.textContent = [...appCss.matchAll(/(?::root|html\[data-theme='(?:light|sage)'\])\s*\{[^}]*\}/g)]
        .map(match => match[0]).join('\n');
    document.head.appendChild(style);
    const previousTheme = document.documentElement.getAttribute('data-theme');
    const template: GameTemplate = { id: 'table', name: 'Table', createdAt: 1, columns: [
        { id: 'input', name: 'Input', color: '#f97316', inputType: 'keypad', formula: 'a1', isScoring: true },
        { id: 'auto-alt', name: 'Auto alt', inputType: 'auto', isAuto: true, formula: '0', isScoring: true },
        { id: 'auto-base', name: 'Auto base', inputType: 'auto', isAuto: true, formula: '0', isScoring: true },
    ] };
    const session: GameSession = { id: 'session', name: 'Table', templateId: template.id, startTime: 1, status: 'active', players: [
        { id: 'red', name: 'Red', color: 'rgb(var(--c-p-red))', scores: {}, totalScore: 0 },
        { id: 'blue', name: 'Blue', color: '#3b82f6', scores: {}, totalScore: 0 },
    ] };
    const scroll = createRef<HTMLDivElement>();
    const content = createRef<HTMLDivElement>();
    const noop = vi.fn();
    try {
        document.documentElement.setAttribute('data-theme', 'light');
        const view = render(<LanguageProvider><ScoreGrid session={session} template={template}
            editingCell={null} editingPlayerId={null} onCellClick={noop} onPlayerHeaderClick={noop}
            onColumnHeaderClick={noop} onUpdateTemplate={noop} onAddColumn={noop}
            scrollContainerRef={scroll} contentRef={content} isEditMode={false} zoomLevel={1} panelDockOffset="0px"
            participantClaimCounts={{ red: 2 }} />
        </LanguageProvider>);
        const playerHeader = view.container.querySelector('[data-player-header-id="red"]') as HTMLElement;
        const headerPaint = playerHeader.style.backgroundColor;
        const inputLabel = view.getByText(text => text.replace(/\u00ad/g, '') === 'Input');
        const read = createColorReader();
        expect(inputLabel.style.textShadow).toBe('none');
        expect(contrastOnBackground(read(inputLabel.style.color)!, read('rgb(var(--c-grid-cell-bg))')!))
            .toBeGreaterThanOrEqual(4.5);
        expect(template.columns[0].color).toBe('#f97316');
        expect(view.getByText('2').parentElement).toHaveClass('bg-modal-backdrop/70', 'text-[rgb(var(--c-player-badge-ink))]');
        for (const theme of ['dark', 'light', 'sage']) {
            document.documentElement.setAttribute('data-theme', theme);
            const read = createColorReader();
            const strength = Number(getComputedStyle(document.documentElement).getPropertyValue('--player-surface-tint-opacity'));
            expect(read(headerPaint)).toEqual({ r: 239, g: 68, b: 68, a: strength });
            expect(playerHeader.style.borderBottomColor).toBe(session.players[0].color);
            expect(playerHeader.style.backgroundColor).toBe(headerPaint);
            for (const id of ['auto-alt', 'auto-base']) {
                const row = view.container.querySelector(`#row-${id}`)!;
                const label = row.firstElementChild as HTMLElement;
                const cell = row.querySelector('[data-score-cell]')!.firstElementChild as HTMLElement;
                expect(read(cell.style.borderColor)).toEqual(read('rgba(var(--c-grid-auto-border))'));
                if (theme === 'dark') {
                    expect(read(cell.style.backgroundColor)).toEqual(read('rgba(var(--c-grid-auto-bg))'));
                } else {
                    expect(read(cell.style.backgroundColor)).toEqual(read(label.style.backgroundColor));
                }
            }
        }
        expect(session.players[0].color).toBe('rgb(var(--c-p-red))');
    } finally {
        style.remove();
        if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', previousTheme);
    }
});
