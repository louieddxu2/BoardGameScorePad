import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n';
import { GameSession } from '../../types';
import MemoTool from './MemoTool';

const session: GameSession = {
    id: 'session-1',
    templateId: 'template-1',
    name: 'Memo test',
    startTime: 1,
    players: [],
    status: 'active',
    note: '',
};

describe('MemoTool keyboard visibility', () => {
    beforeEach(() => {
        vi.mocked(window.HTMLElement.prototype.scrollIntoView).mockClear();
    });

    it('leaves viewport scrolling to its toolbox owner', () => {
        render(
            <LanguageProvider>
                <MemoTool session={session} onUpdateSession={vi.fn()} />
            </LanguageProvider>,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.focus(textarea);

        expect(textarea).toHaveClass('text-sm');
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
});
