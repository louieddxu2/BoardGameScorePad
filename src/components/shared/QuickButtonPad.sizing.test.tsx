import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import postcss from 'postcss';
import { LanguageProvider } from '../../i18n';
import { evaluateFormula } from '../../utils/formulaEvaluator';
import type { ScoreColumn } from '../../types';
import appCss from '../../index.css?raw';
import QuickButtonPad from './QuickButtonPad';

const column = {
  id: 'quick', name: 'Quick actions', formula: 'a1', inputType: 'clicker', isScoring: true,
  quickActions: [{ id: 'one', label: 'One', value: 1 }],
} satisfies ScoreColumn;

const stylesheet = postcss.parse(appCss);
const getRule = (selector: string) => {
  const rules: postcss.Rule[] = [];
  stylesheet.walkRules(selector, rule => { rules.push(rule); });
  expect(rules, `production CSS rule ${selector}`).toHaveLength(1);
  return rules[0];
};

// Model only the declared font-size arithmetic with explicit fixture widths.
// JSDOM cannot measure container queries, wrapping, or real Safari geometry.
const modelFontSize = (label: HTMLElement, rootFontSize: number, availableWidth: number) => {
  const rule = getRule('.quick-button-label > .quick-button-label-text');
  let expression = '';
  rule.walkDecls('font-size', declaration => { expression = declaration.value; });
  expect(expression).not.toBe('');
  const properties = new Map<string, string>();
  for (let element: HTMLElement | null = label; element; element = element.parentElement) {
    for (const property of Array.from(element.style)) {
      if (property.startsWith('--quick-button-') && !properties.has(property)) {
        properties.set(property, element.style.getPropertyValue(property));
      }
    }
  }
  for (let pass = 0; pass < 8 && expression.includes('var('); pass++) {
    expression = expression.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
      const value = properties.get(name);
      if (!value) throw new Error(`Missing sizing property ${name}`);
      return `(${value})`;
    });
  }
  expect(expression).not.toContain('var(');
  expression = expression
    .replace(/(\d+(?:\.\d+)?)(rem|cqi|px)\b/g, (_, value: string, unit: string) =>
      String(Number(value) * (unit === 'rem' ? rootFontSize : unit === 'cqi' ? availableWidth / 100 : 1)))
    .replace(/\bcalc\(/g, '(').replace(/\bmin\(/g, 'f1(').replace(/\bclamp\(/g, 'f2(');
  return evaluateFormula(expression, {}, {
    f1: Math.min,
    f2: (minimum: number, preferred: number, maximum: number) => Math.max(minimum, Math.min(preferred, maximum)),
  });
};

const renderPad = (buttonGridColumns: number, renderMode: 'standard' | 'label_only', extra: Partial<ScoreColumn> = {}) => {
  const onAction = vi.fn();
  render(<LanguageProvider><QuickButtonPad column={{ ...column, buttonGridColumns, renderMode, ...extra }} onAction={onAction} /></LanguageProvider>);
  const button = screen.getByRole('button');
  return { button, label: within(button).getByText('One'), onAction };
};

describe('QuickButtonPad available-space typography', () => {
  it('queries only the label width and does not use content-driven height units', () => {
    const containerRule = getRule('.quick-button-label');
    const fontRule = getRule('.quick-button-label > .quick-button-label-text');
    expect(containerRule.parent?.type).toBe('atrule');
    expect((containerRule.parent as postcss.AtRule).name).toBe('supports');
    expect((containerRule.parent as postcss.AtRule).params).toContain('container-type: inline-size');
    expect((containerRule.parent as postcss.AtRule).params).toContain('font-size: 1cqi');
    expect(fontRule.parent).toBe(containerRule.parent);
    const declarations: Record<string, string> = {};
    containerRule.walkDecls(declaration => { declarations[declaration.prop] = declaration.value; });
    expect(declarations['container-type']).toBe('inline-size');
    fontRule.walkDecls('font-size', declaration => {
      expect(declaration.value).toContain('cqi');
      expect(declaration.value).not.toMatch(/\bcq(?:h|b|min|max)\b/);
    });
  });

  describe.each([1, 2, 3])('%i columns', (cols) => {
    it.each(['standard', 'label_only'] as const)('reserves badge height only for stacked values in %s mode', (mode) => {
      const { button, label } = renderPad(cols, mode);
      const wrapper = label.parentElement!;
      expect(wrapper).toHaveClass('quick-button-label', 'pointer-events-none');
      expect(label).toHaveClass('quick-button-label-text', 'break-words', 'whitespace-pre-wrap');
      expect(button.parentElement!.style.getPropertyValue('--quick-button-row-height')).toBe(cols === 1 ? '3.5rem' : '4.5rem');
      expect(button.style.getPropertyValue('--quick-button-value-reserve')).toBe(cols > 1 && mode === 'standard' ? '1.8125rem' : '0rem');
      expect(wrapper.style.height).toBe('');
      expect(wrapper).not.toHaveClass('h-full', 'overflow-hidden');
      if (cols === 1) expect(wrapper).toHaveClass('flex-1', 'min-w-0');
      else expect(wrapper).toHaveClass('w-full');
      if (cols > 1 && mode === 'standard') expect(wrapper).toHaveClass('mb-1');
      else expect(wrapper).not.toHaveClass('mb-1');
      if (mode === 'standard') expect(within(button).getByText('1')).toHaveClass('leading-normal', 'shrink-0');
    });

    it.each([
      { root: 12, listWide: 22.4, gridStandard: 14.6 },
      { root: 16, listWide: 30.4, gridStandard: 20 },
      { root: 20.8, listWide: 40, gridStandard: 26.48 },
    ])('models the production size formula at root $root px', ({ root, listWide, gridStandard }) => {
      render(
        <LanguageProvider>
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'standard' }} onAction={vi.fn()} />
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'label_only' }} onAction={vi.fn()} />
        </LanguageProvider>,
      );
      const standard = within(screen.getByRole('button', { name: 'One 1' })).getByText('One');
      const labelOnly = within(screen.getByRole('button', { name: 'One' })).getByText('One');
      expect(modelFontSize(standard, root, 160)).toBeCloseTo(cols === 1 ? listWide : gridStandard);
      expect(modelFontSize(labelOnly, root, 160)).toBeCloseTo(cols === 1 ? listWide : 2 * root);
      expect(modelFontSize(labelOnly, root, 64)).toBeGreaterThan(modelFontSize(labelOnly, root, 32));
      expect(modelFontSize(labelOnly, root, 64)).toBeLessThanOrEqual(modelFontSize(labelOnly, root, 160));
      expect(modelFontSize(labelOnly, root, 64)).toBeLessThanOrEqual(2 * root);
      if (cols > 1) expect(modelFontSize(labelOnly, root, 64)).toBeGreaterThan(modelFontSize(standard, root, 64));
    });
  });

  it('accounts for the existing thicker modifier border', () => {
    const { button, label } = renderPad(3, 'standard', { formula: 'a1+next', quickActions: [{ ...column.quickActions[0], isModifier: true }] });
    expect(button).toHaveClass('border-2');
    expect(button.style.getPropertyValue('--quick-button-border-height')).toBe('4px');
    expect(modelFontSize(label, 16, 160)).toBeCloseTo(18.4);
  });

  it('does not feed multiline content back into the font-size budget or clip the label', () => {
    const action = { ...column.quickActions[0], label: '五座帳篷\n這是一個較長的選項標籤\n仍需完整顯示' };
    const onAction = vi.fn();
    render(<LanguageProvider><QuickButtonPad column={{ ...column, buttonGridColumns: 3, renderMode: 'label_only', quickActions: [action] }} onAction={onAction} /></LanguageProvider>);
    const button = screen.getByRole('button');
    const label = within(button).getByText(/五座帳篷/);
    expect(label.textContent).toBe(action.label);
    expect(label).not.toHaveClass('truncate');
    expect(label).not.toHaveClass('whitespace-nowrap');
    expect(label).not.toHaveClass('overflow-hidden');
    expect(button.parentElement!.style.gridAutoRows).toBe('minmax(4.5rem, auto)');
    expect(button.closest('.overflow-y-auto')).toHaveClass('flex-1', 'min-h-0');
    expect(modelFontSize(label, 16, 64)).toBeCloseTo(26.4);
    fireEvent.click(label);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
  });
});
