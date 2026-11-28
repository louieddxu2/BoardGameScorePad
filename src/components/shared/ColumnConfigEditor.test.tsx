import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScoreColumn } from '../../types';
import { ConfirmationProvider } from '../../hooks/useConfirm';
import { LanguageContext } from '../../i18n';
import ColumnConfigEditor from './ColumnConfigEditor';

const trees: ScoreColumn = {
    id: 'trees', name: 'Trees', formula: 'a1', inputType: 'keypad', isScoring: true,
};
const automatic: ScoreColumn = {
    id: 'automatic', name: 'Automatic', formula: '', inputType: 'auto', isAuto: true, isScoring: true,
};

const renderEditor = (column = automatic) => {
    const onSave = vi.fn();
    render(
        <LanguageContext.Provider value={{ language: 'en', setLanguage: vi.fn() }}>
            <ConfirmationProvider>
                <ColumnConfigEditor column={column} allColumns={[trees, column]}
                    onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />
            </ConfirmationProvider>
        </LanguageContext.Provider>,
    );
    return onSave;
};

const getFormulaInput = () => screen.getByPlaceholderText<HTMLInputElement>('f1(x1) + f2(x2)');
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

afterEach(cleanup);

describe('list options', () => {
    it.each([
        ['Standard', 'standard'],
        ['Value Only', 'value_only'],
        ['Label Only', 'label_only'],
    ])('saves new options with zero in %s mode', (mode, renderMode) => {
        const existingOption = { id: 'oak', label: 'Oak', value: 5, isModifier: false };
        const onSave = renderEditor({ ...trees, id: 'list', inputType: 'clicker', quickActions: [existingOption] });

        fireEvent.click(screen.getByRole('button', { name: mode }));
        fireEvent.click(screen.getByRole('button', { name: 'Add Button' }));
        const [, newValue] = screen.getAllByPlaceholderText('0');
        expect(newValue).toHaveValue('0');
        const [, newLabel] = screen.getAllByPlaceholderText('Label');
        fireEvent.change(newLabel, { target: { value: 'Pine' } });
        save();

        expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            renderMode,
            quickActions: [existingOption, expect.objectContaining({ label: 'Pine', value: 0 })],
        }));
    });
});

describe('automatic formula draft', () => {
    it('saves a typed formula and its bindings directly', () => {
        const onSave = renderEditor();
        fireEvent.change(getFormulaInput(), { target: { value: 'f1(x1) + 2' } });
        save();

        expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            formula: 'f1(x1) + 2',
            variableMap: { x1: { id: 'trees', name: 'Trees', mode: 'value' } },
            functions: { f1: [{ min: 0, score: 0 }] },
            f1: [{ min: 0, score: 0 }],
        }));
    });

    it('parses the text produced by shortcut insertion and saves the same formula', () => {
        const onSave = renderEditor();
        fireEvent.click(screen.getByRole('button', { name: 'xi' }));
        const input = getFormulaInput();
        expect(input.value).toBe('x1');
        const parseButton = input.parentElement?.querySelector('button');
        if (!parseButton) throw new Error('Formula parse button not found');
        fireEvent.click(parseButton);
        expect(input.disabled).toBe(true);
        save();

        expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            formula: 'x1',
            variableMap: { x1: { id: 'trees', name: 'Trees', mode: 'value' } },
        }));
    });

    it('restores the current draft when switching away from the automatic tab', () => {
        const onSave = renderEditor();
        fireEvent.change(getFormulaInput(), { target: { value: 'x1 + 5' } });
        fireEvent.click(screen.getByRole('button', { name: 'Basic' }));
        fireEvent.click(screen.getByRole('button', { name: 'Auto' }));

        expect(getFormulaInput().value).toBe('x1 + 5');
        save();
        expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ formula: 'x1 + 5' }));
    });
});
