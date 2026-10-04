import React from 'react';
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { LanguageProvider } from '../../i18n';
import { useMobileZoom } from '../../hooks/useMobileZoom';
import { evaluateFormula } from '../../utils/formulaEvaluator';
import * as textUtils from '../../utils/text';
import * as typographyUtils from './quickButtonTypography';
import type { ScoreColumn } from '../../types';
import appCss from '../../index.css?raw';
import QuickButtonPad from './QuickButtonPad';
import InputPanelLayout from '../session/parts/InputPanelLayout';
import quickPadSource from './QuickButtonPad.tsx?raw';
import inputLayoutSource from '../session/parts/InputPanelLayout.tsx?raw';

const column = {
  id: 'quick', name: 'Quick actions', formula: 'a1', inputType: 'clicker', isScoring: true,
  quickActions: [{ id: 'one', label: 'One', value: 1 }],
} satisfies ScoreColumn;

const fontSizeCases = [
  { root: 12, listWide: 22.8, gridStandard: 15 },
  { root: 16, listWide: 30.4, gridStandard: 20 },
  { root: 20.8, listWide: 39.52, gridStandard: 26 },
];

const stylesheet = postcss.parse(appCss);
let spacingStylesheet: postcss.Root;
beforeAll(async () => {
  // Resolve spacing from real production classes, not a constant-width fixture.
  const result = await postcss([tailwindcss({
    content: [{ raw: `${quickPadSource}\n${inputLayoutSource}`, extension: 'tsx' }],
    corePlugins: ['padding', 'gap', 'margin'],
  })]).process('@tailwind utilities', { from: undefined });
  spacingStylesheet = result.root;
});

const spacingPixels = (element: HTMLElement, property: string, rootFontSize: number) => {
  let value = '';
  spacingStylesheet.walkRules(rule => {
    if (!element.matches(rule.selector)) return;
    rule.walkDecls(declaration => {
      if (declaration.prop === property || (property.startsWith('padding-') && declaration.prop === 'padding')) {
        value = declaration.value;
      }
    });
  });
  expect(value, `${property} on ${element.className}`).toMatch(/^\d+(?:\.\d+)?(?:px|rem)$/);
  return parseFloat(value) * (value.endsWith('rem') ? rootFontSize : 1);
};

const horizontalPadding = (element: HTMLElement, root: number) =>
  spacingPixels(element, 'padding-left', root) + spacingPixels(element, 'padding-right', root);

// This models the rendered components' declared grid geometry. It is not a
// browser measurement: JSDOM cannot lay out container-query text.
const modelPanelLabelWidth = (button: HTMLElement, panelWidth: number, cols: number, root: number) => {
  const grid = button.parentElement!;
  const scroll = grid.parentElement!;
  const main = scroll.parentElement!;
  const layout = main.parentElement!;
  expect(layout).toHaveClass('grid-cols-4');
  expect(main).toHaveClass('col-span-3');
  const panelGap = spacingPixels(layout, 'gap', root);
  const panelTrack = (panelWidth - horizontalPadding(layout, root) - 3 * panelGap) / 4;
  const mainWidth = 3 * panelTrack + 2 * panelGap;
  const gridWidth = mainWidth - horizontalPadding(scroll, root);
  const buttonWidth = (gridWidth - (cols - 1) * spacingPixels(grid, 'gap', root)) / cols;
  return buttonWidth - horizontalPadding(button, root)
    - parseFloat(button.style.getPropertyValue('--quick-button-border-height'));
};
const getRule = (selector: string) => {
  const rules: postcss.Rule[] = [];
  stylesheet.walkRules(selector, rule => { rules.push(rule); });
  expect(rules, `production CSS rule ${selector}`).toHaveLength(1);
  return rules[0];
};

// Model only the declared font-size arithmetic with explicit fixture widths.
// JSDOM cannot measure container queries, wrapping, or real Safari geometry.
const modelFontSize = (label: HTMLElement, rootFontSize: number, availableWidth: number) => {
  let expression = '';
  const fontSelectors = new Set(['.quick-button-label > .quick-button-label-text']);
  stylesheet.walkRules(rule => {
    if (fontSelectors.has(rule.selector) && label.matches(rule.selector)) {
      rule.walkDecls('font-size', declaration => { expression = declaration.value; });
    }
  });
  expect(expression).not.toBe('');
  const properties = new Map<string, string>();
  for (let element: HTMLElement | null = label; element; element = element.parentElement) {
    for (const property of Array.from(element.style)) {
      if ((property.startsWith('--quick-button-') || property === '--app-zoom-level') && !properties.has(property)) {
        properties.set(property, element.style.getPropertyValue(property));
      }
    }
  }
  for (let pass = 0; pass < 8 && expression.includes('var('); pass++) {
    expression = expression.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name: string, fallback?: string) => {
      const value = properties.get(name) ?? fallback;
      if (!value) throw new Error(`Missing sizing property ${name}`);
      return `(${value})`;
    });
  }
  expect(expression).not.toContain('var(');
  expression = expression
    .replace(/(\d+(?:\.\d+)?)(rem|cqi|px)\b/g, (_, value: string, unit: string) =>
      String(Number(value) * (unit === 'rem' ? rootFontSize : unit === 'cqi' ? availableWidth / 100 : 1)))
    .replace(/\bcalc\(/g, '(').replace(/\bmin\(/g, 'f1(').replace(/\bclamp\(/g, 'f2(').replace(/\bmax\(/g, 'f3(');
  return evaluateFormula(expression, {}, {
    f1: Math.min,
    f2: (minimum: number, preferred: number, maximum: number) => Math.max(minimum, Math.min(preferred, maximum)),
    f3: Math.max,
  });
};

const renderPad = (buttonGridColumns: number, renderMode: 'standard' | 'label_only', extra: Partial<ScoreColumn> = {}) => {
  const onAction = vi.fn();
  render(<LanguageProvider><QuickButtonPad column={{ ...column, buttonGridColumns, renderMode, ...extra }} onAction={onAction} /></LanguageProvider>);
  const button = screen.getByRole('button');
  return { button, label: button.querySelector<HTMLElement>('.quick-button-label-text')!, onAction };
};

describe('QuickButtonPad available-space typography', () => {
  let previousFontSize: string;
  let previousZoomProperty: string;
  let previousSavedZoom: string | null;

  beforeEach(() => {
    previousFontSize = document.documentElement.style.fontSize;
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    previousSavedZoom = localStorage.getItem('app_zoom_level');
    document.documentElement.style.fontSize = '16px';
    document.documentElement.style.removeProperty('--app-zoom-level');
    localStorage.removeItem('app_zoom_level');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousSavedZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousSavedZoom);
  });

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
    const labelOnlyOverrides: postcss.Rule[] = [];
    stylesheet.walkRules('.quick-button-label-only > .quick-button-label-text', rule => { labelOnlyOverrides.push(rule); });
    expect(labelOnlyOverrides).toHaveLength(0);
  });

  // Spacing and badge placement share two structures: a list and a grid.
  describe.each([1, 3])('%i-column layout structure', (cols) => {
    it.each(['standard', 'label_only'] as const)('keeps %s padding and gaps fixed while zooming', (mode) => {
      const { button, label } = renderPad(cols, mode);
      const grid = button.parentElement!;
      const scroll = grid.parentElement!;
      for (const root of [12, 16, 20.8]) {
        expect(horizontalPadding(button, root)).toBe(cols === 1 ? 32 : 16);
        expect(spacingPixels(button, 'padding-top', root)).toBe(8);
        expect(spacingPixels(button, 'padding-bottom', root)).toBe(8);
        expect(horizontalPadding(scroll, root)).toBe(16);
        expect(spacingPixels(grid, 'gap', root)).toBe(8);
        if (mode === 'standard') {
          const badge = within(button).getByText('1');
          expect(horizontalPadding(badge, root)).toBe(cols === 1 ? 24 : 16);
          expect(spacingPixels(badge, 'padding-top', root)).toBe(cols === 1 ? 4 : 2);
          expect(spacingPixels(badge, 'padding-bottom', root)).toBe(cols === 1 ? 4 : 2);
          if (cols > 1) expect(spacingPixels(label.parentElement!, 'margin-bottom', root)).toBe(4);
        }
      }
    });

    it.each(['standard', 'label_only'] as const)('reserves badge height only for stacked values in %s mode', (mode) => {
      const { button, label } = renderPad(cols, mode);
      const wrapper = label.parentElement!;
      expect(wrapper).toHaveClass('quick-button-label', 'pointer-events-none');
      if (mode === 'label_only') expect(wrapper).toHaveClass('quick-button-label-only');
      else expect(wrapper).not.toHaveClass('quick-button-label-only');
      expect(label).toHaveClass('quick-button-label-text', 'break-words', 'whitespace-pre-wrap');
      expect(button.parentElement!.style.gridAutoRows).toBe(cols === 1 ? 'minmax(3.5rem, auto)' : 'minmax(4.5rem, auto)');
      expect(button.style.getPropertyValue('--quick-button-label-height')).toBe(cols === 1 ? '38px' : mode === 'standard' ? '25px' : '54px');
      expect(wrapper.style.height).toBe('');
      expect(wrapper).not.toHaveClass('h-full', 'overflow-hidden');
      if (cols === 1) expect(wrapper).toHaveClass('flex-1', 'min-w-0');
      else expect(wrapper).toHaveClass('w-full');
      if (cols > 1 && mode === 'standard') expect(wrapper).toHaveClass('mb-[4px]');
      else expect(wrapper).not.toHaveClass('mb-[4px]');
      if (mode === 'standard') expect(within(button).getByText('1')).toHaveClass('leading-normal', 'shrink-0');
    });
  });

  // Keep every column's baseline; exercise both zoom limits on the two
  // structures. Narrow three/four-column panel geometry is covered below.
  describe.each([
    { cols: 1, sizes: fontSizeCases },
    { cols: 2, sizes: [fontSizeCases[1]] },
    { cols: 3, sizes: fontSizeCases },
    { cols: 4, sizes: [fontSizeCases[1]] },
  ])('$cols columns', ({ cols, sizes }) => {
    it.each(sizes)('models the production size formula at root $root px', ({ root, listWide, gridStandard }) => {
      localStorage.setItem('app_zoom_level', String(root / 16));
      renderHook(() => useMobileZoom());
      render(
        <LanguageProvider>
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'standard' }} onAction={vi.fn()} />
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'label_only' }} onAction={vi.fn()} />
        </LanguageProvider>,
      );
      const standard = within(screen.getByRole('button', { name: /^One\s*1$/ })).getByText('One');
      const labelOnly = within(screen.getByRole('button', { name: 'One' })).getByText('One');
      expect(modelFontSize(standard, root, 160)).toBeCloseTo(cols === 1 ? listWide : gridStandard);
      expect(modelFontSize(labelOnly, root, 160)).toBeCloseTo(cols === 1 ? listWide : 43.2 * (root / 16));
      expect(modelFontSize(labelOnly, root, 64)).toBeGreaterThan(modelFontSize(labelOnly, root, 32));
      expect(modelFontSize(labelOnly, root, 64)).toBeLessThanOrEqual(modelFontSize(labelOnly, root, 160));
      // 'One' has a conservative 2.1 full-width equivalent, not four glyphs.
      expect(modelFontSize(labelOnly, root, 64)).toBeCloseTo((64 * 0.96 / 2.1) * (root / 16));
      if (cols > 1) expect(modelFontSize(labelOnly, root, 160)).toBeGreaterThan(modelFontSize(standard, root, 160));
    });

    it('budgets the column capacity rather than fitting an entire long label on one line', () => {
      const { label } = renderPad(cols, 'label_only', {
        quickActions: [{ ...column.quickActions[0], label: '五座帳篷' }],
      });
      expect(label.textContent).toBe('五座帳篷');
      const expectedLineWidth = cols === 4 ? 3 : 4;
      expect(label.closest('button')!.style.getPropertyValue('--quick-button-label-lines')).toBe(cols === 4 ? '2' : '1');

      for (const availableWidth of [48, 64, 80, 96, 112, 160]) {
        const fontSize = modelFontSize(label, 16, availableWidth);
        // Full-width glyphs nominally advance by 1em; this is a size budget,
        // not a claim that JSDOM measures font metrics or rendered wrapping.
        expect(fontSize * expectedLineWidth, `${expectedLineWidth} glyphs at ${availableWidth}px label width`).toBeLessThanOrEqual(availableWidth * 0.96 + 0.001);
        expect(fontSize).toBeLessThanOrEqual(cols === 1 ? 30.4 : cols === 4 ? 21.6 : 43.2);
        expect(fontSize).toBeGreaterThan(0);
      }
    });

    it('enlarges narrow labels when pinching instead of preserving four glyphs per line', () => {
      renderHook(() => useMobileZoom());
      const { button, label, onAction } = renderPad(cols, 'label_only', {
        quickActions: [{ ...column.quickActions[0], label: '五座帳篷' }],
      });
      const defaultSize = modelFontSize(label, 16, 64);

      fireEvent.touchStart(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }] });
      fireEvent.touchMove(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 180, clientY: 0 }] });
      fireEvent.touchEnd(button, { touches: [], changedTouches: [{ clientX: 0, clientY: 0 }, { clientX: 180, clientY: 0 }] });

      expect(document.documentElement.style.fontSize).toBe('20.8px');
      const enlargedSize = modelFontSize(label, 20.8, 64);
      expect(enlargedSize).toBeCloseTo(defaultSize * 1.3);
      expect(enlargedSize).toBeGreaterThan(defaultSize);
      expect(enlargedSize * 4).toBeGreaterThan(64);
      expect(label).toHaveClass('break-words', 'whitespace-pre-wrap');
      expect(label).not.toHaveClass('truncate');
      expect(button.parentElement!.style.gridAutoRows).toBe(cols === 1 ? 'minmax(3.5rem, auto)' : 'minmax(4.5rem, auto)');
      expect(onAction).not.toHaveBeenCalled();

      fireEvent.touchStart(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }] });
      fireEvent.touchMove(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 50, clientY: 0 }] });
      fireEvent.touchEnd(button, { touches: [], changedTouches: [{ clientX: 0, clientY: 0 }, { clientX: 50, clientY: 0 }] });

      expect(document.documentElement.style.fontSize).toBe('12px');
      expect(modelFontSize(label, 12, 64)).toBeCloseTo(defaultSize * 0.75);
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  it.each([[2, 5], [3, 4], [4, 3]])('publishes %i-column line capacity %i for both display modes', (cols, capacity) => {
    render(
      <LanguageProvider>
        <QuickButtonPad column={{ ...column, buttonGridColumns: cols }} onAction={vi.fn()} />
        <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'label_only' }} onAction={vi.fn()} />
      </LanguageProvider>,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button.style.getPropertyValue('--quick-button-line-capacity')).toBe(String(capacity));
    }
  });

  it('makes short full-width labels larger without changing their one-line text', () => {
    render(
      <LanguageProvider>
        <QuickButtonPad column={{ ...column, buttonGridColumns: 3, renderMode: 'label_only', quickActions: [
          { id: 'short', label: '森林', value: 1 }, { id: 'long', label: '五座帳篷', value: 2 },
        ] }} onAction={vi.fn()} />
      </LanguageProvider>,
    );
    const short = screen.getByText('森林');
    const long = screen.getByText('五座帳篷');
    const shortFont = modelFontSize(short, 16, 64);
    expect(shortFont).toBeGreaterThan(28);
    expect(shortFont).toBeCloseTo(modelFontSize(long, 16, 64) * 2);
    expect(shortFont * 2).toBeLessThanOrEqual(64 * 0.96 + 0.001);
  });

  it('budgets manual lines separately and keeps the original action unchanged', () => {
    const action = { id: 'manual', label: '森林\r\n\r\n山谷\r\n', value: 1 };
    const { button, label, onAction } = renderPad(3, 'label_only', { quickActions: [action] });
    expect(label.textContent).toBe('森林\n\n山谷\n');
    expect(button.style.getPropertyValue('--quick-button-label-width-units')).toBe('2');
    expect(button.style.getPropertyValue('--quick-button-label-lines')).toBe('3');
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
    expect(action.label).toBe('森林\r\n\r\n山谷\r\n');
  });

  it('shares the nominal height between manual lines without shrinking indefinitely', () => {
    render(
      <LanguageProvider>
        <QuickButtonPad column={{ ...column, buttonGridColumns: 3, renderMode: 'label_only', quickActions: [
          { id: 'single', label: '森林', value: 1 },
          { id: 'double', label: '森林\n山谷', value: 2 },
          { id: 'many', label: '森林\n\n山谷\n\n山谷', value: 3 },
        ] }} onAction={vi.fn()} />
      </LanguageProvider>,
    );
    const labels = screen.getAllByRole('button').map(button => button.querySelector<HTMLElement>('.quick-button-label-text')!);
    expect(modelFontSize(labels[0], 16, 160)).toBeCloseTo(43.2);
    expect(modelFontSize(labels[1], 16, 160)).toBeCloseTo(21.6);
    expect(modelFontSize(labels[2], 16, 160)).toBeCloseTo(16);
    expect(labels[2].closest('button')!.parentElement!.style.gridAutoRows).toBe('minmax(4.5rem, auto)');
  });

  it('reuses text analysis through zoom, selection and value changes, but refreshes changed labels or columns', () => {
    const analyze = vi.spyOn(typographyUtils, 'getQuickButtonTypography');
    const hyphenate = vi.spyOn(textUtils, 'injectSoftHyphens');
    const onAction = vi.fn();
    const initial = { ...column, buttonGridColumns: 3, renderMode: 'label_only' as const };
    const pad = (current: ScoreColumn, selected?: string) => (
      <LanguageProvider><QuickButtonPad column={current} currentOptionId={selected} onAction={onAction} /></LanguageProvider>
    );
    renderHook(() => useMobileZoom());
    const { rerender } = render(pad(initial));
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(hyphenate).toHaveBeenCalledTimes(1);

    const button = screen.getByRole('button');
    fireEvent.touchStart(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }] });
    fireEvent.touchMove(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 180, clientY: 0 }] });
    fireEvent.touchEnd(button, { touches: [], changedTouches: [{ clientX: 0, clientY: 0 }, { clientX: 180, clientY: 0 }] });
    rerender(pad({ ...initial, quickActions: [{ ...column.quickActions[0], value: 99 }] }, 'one'));
    expect(document.documentElement.style.fontSize).toBe('20.8px');
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(hyphenate).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();

    const changed = { ...initial, quickActions: [{ ...column.quickActions[0], label: '森林\n山谷' }] };
    rerender(pad(changed));
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(hyphenate).toHaveBeenCalledTimes(2);
    expect(button.style.getPropertyValue('--quick-button-label-width-units')).toBe('2');
    expect(button.style.getPropertyValue('--quick-button-label-lines')).toBe('2');
    rerender(pad({ ...changed, buttonGridColumns: 4 }));
    expect(analyze).toHaveBeenCalledTimes(3);
    expect(hyphenate).toHaveBeenCalledTimes(3);
    expect(button.style.getPropertyValue('--quick-button-line-capacity')).toBe('3');
  });

  // Cover narrow/wide sizes in both layouts and column counts. Four-column
  // cases exercise width and height bounds; 375px repeats the narrow branch.
  it.each([
    { isCompact: false, cols: 3, panelWidth: 320 },
    { isCompact: false, cols: 3, panelWidth: 768 },
    { isCompact: false, cols: 4, panelWidth: 320 },
    { isCompact: false, cols: 4, panelWidth: 768 },
    { isCompact: true, cols: 3, panelWidth: 320 },
    { isCompact: true, cols: 3, panelWidth: 768 },
    { isCompact: true, cols: 4, panelWidth: 320 },
    { isCompact: true, cols: 4, panelWidth: 768 },
  ])('enlarges text across the real spacing chain: compact=$isCompact, $cols columns, $panelWidth px', ({ isCompact, cols, panelWidth }) => {
    renderHook(() => useMobileZoom());
    const onAction = vi.fn();
    render(
      <LanguageProvider>
        <InputPanelLayout isCompact={isCompact} onNext={vi.fn()}>
          <QuickButtonPad column={{ ...column, buttonGridColumns: cols, renderMode: 'label_only', quickActions: [
            { ...column.quickActions[0], label: '五座帳篷' },
          ] }} onAction={onAction} />
        </InputPanelLayout>
      </LanguageProvider>,
    );
    const button = screen.getByRole('button', { name: '五座帳篷' });
    const label = within(button).getByText('五座帳篷');
    const defaultWidth = modelPanelLabelWidth(button, panelWidth, cols, 16);
    const defaultSize = modelFontSize(label, 16, defaultWidth);
    expect(defaultWidth).toBeGreaterThan(0);
    expect(defaultSize * (cols === 4 ? 3 : 4)).toBeLessThanOrEqual(defaultWidth * 0.96 + 0.001);

    for (const [distance, zoom] of [[180, 1.3], [50, 0.75]]) {
      fireEvent.touchStart(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }] });
      fireEvent.touchMove(button, { touches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }] });
      fireEvent.touchEnd(button, { touches: [], changedTouches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }] });
      const root = 16 * zoom;
      expect(document.documentElement.style.fontSize).toBe(`${root}px`);
      const width = modelPanelLabelWidth(button, panelWidth, cols, root);
      // App zoom must enlarge text, not consume its horizontal space.
      expect(width, `${cols} columns at ${zoom} zoom`).toBeCloseTo(defaultWidth);
      expect(modelFontSize(label, root, width)).toBeCloseTo(defaultSize * zoom);
      expect(onAction).not.toHaveBeenCalled();
    }
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
    expect(modelFontSize(label, 16, 64)).toBeCloseTo(15.36);
    fireEvent.click(label);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
  });
});
