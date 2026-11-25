import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import type { FilterableGameRule } from '../rulesCache';
import RuleCard from './RuleCard';

const rule = (extra: Partial<FilterableGameRule> = {}): FilterableGameRule => ({
  id: 'r1', statement: '建造船隻時不能從遠方拉部落上船', commonMistake: '玩成可以從遠方拉部落',
  categories: [], playerCounts: [], editionNotes: [], sourceLinks: [], reviewStatus: 'reviewed',
  importanceCount: 0, tagIds: [], tags: [], createdAt: 1, updatedAt: 1, ...extra,
} as FilterableGameRule);

/**
 * jsdom lays nothing out: a clamped rule reports the given number of cut-off 20px lines,
 * and the details paragraph the given number of 20px lines.
 */
const layOut = (cutLines: number, detailLines = 0) => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('line-clamp-3') ? 60 + cutLines * 20 : 60;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('text-sm') ? detailLines * 20 : 20;
  });
};

const renderCard = (value: FilterableGameRule) => render(<LanguageProvider><RuleCard rule={value} /></LanguageProvider>);
const statement = () => screen.getByText('建造船隻時不能從遠方拉部落上船');

beforeEach(() => localStorage.setItem('app_language', 'zh-TW'));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('rule card folding', () => {
  it('prints a rule whose fold would hide only one line, with nothing to expand', () => {
    layOut(1);
    renderCard(rule());
    expect(statement()).not.toHaveClass('line-clamp-3');
    expect(screen.queryByRole('button', { name: /^展開規則/ })).not.toBeInTheDocument();
  });

  it('folds a rule that hides more than one line, behind the arrow', () => {
    layOut(2);
    renderCard(rule());
    expect(statement()).toHaveClass('line-clamp-3');
    fireEvent.click(screen.getByRole('button', { name: /^展開規則/ }));
    expect(statement()).not.toHaveClass('line-clamp-3');
  });

  it('prints a one-line detail when nothing else is cut off', () => {
    layOut(0, 1);
    renderCard(rule({ details: '只能拉相鄰的部落' }));
    expect(screen.getByText('只能拉相鄰的部落')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^展開規則/ })).not.toBeInTheDocument();
  });

  it('folds when a cut-off line and a detail line together would be revealed', () => {
    layOut(1, 1);
    renderCard(rule({ details: '只能拉相鄰的部落' }));
    expect(statement()).toHaveClass('line-clamp-3');
    expect(screen.queryByText('只能拉相鄰的部落')).not.toBeInTheDocument();
    fireEvent.click(statement());
    expect(screen.getByText('只能拉相鄰的部落')).toBeInTheDocument();
  });
});
