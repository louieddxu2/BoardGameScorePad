import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('calculateDynamicFontSize browser compatibility', () => {
  it.each([
    ['no CSS API', undefined],
    ['no supports API', {}],
    ['no size containment', { supports: (property: string) => property !== 'container-type' }],
    ['no container font units', { supports: (property: string) => property !== 'font-size' }],
  ])('uses a zoomable rem baseline with %s', async (_name, css) => {
    vi.stubGlobal('CSS', css);
    const { calculateDynamicFontSize } = await import('./dynamicLayout');
    expect(calculateDynamicFontSize('123')).toBe('1rem');
    expect(calculateDynamicFontSize('First\nSecond')).toBe('1rem');
  });

  it('preserves container fitting and manual line breaks on supported browsers', async () => {
    const supports = vi.fn(() => true);
    vi.stubGlobal('CSS', { supports });
    const { calculateDynamicFontSize } = await import('./dynamicLayout');

    expect(calculateDynamicFontSize('12\r\n3456'))
      .toBe('min(calc(85cqh / 2), calc(170cqw / 4.5))');
    expect(calculateDynamicFontSize(123))
      .toBe('min(calc(85cqh / 1), calc(170cqw / 3.5))');
    expect(calculateDynamicFontSize(['1', '234']))
      .toBe('min(calc(85cqh / 2), calc(170cqw / 3.5))');
    expect(supports.mock.calls).toEqual([
      ['container-type', 'size'],
      ['font-size', 'min(1cqh, 1cqw)'],
    ]);
  });

  it('caches a negative capability result across cells', async () => {
    const supports = vi.fn(() => false);
    vi.stubGlobal('CSS', { supports });
    const { calculateDynamicFontSize } = await import('./dynamicLayout');
    calculateDynamicFontSize('1');
    calculateDynamicFontSize('2');
    expect(supports).toHaveBeenCalledTimes(1);
  });

  it('keeps empty inputs on the baseline without probing browser support', async () => {
    const supports = vi.fn(() => true);
    vi.stubGlobal('CSS', { supports });
    const { calculateDynamicFontSize } = await import('./dynamicLayout');
    for (const input of [undefined, null, '']) {
      expect(calculateDynamicFontSize(input)).toBe('1rem');
    }
    expect(supports).not.toHaveBeenCalled();
  });
});
