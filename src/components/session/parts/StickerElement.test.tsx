import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import StickerElement from './StickerElement';

describe('anonymous sticker contrast', () => {
  afterEach(() => document.documentElement.style.removeProperty('--c-txt-secondary'));

  it('outlines dark and light player colors without replacing their original stroke or fill', () => {
    const { container, rerender } = render(<StickerElement id="player" color="#111111" />);
    const outline = () => container.querySelector('[data-sticker-outline]')!;
    const icon = () => container.querySelector('[data-sticker-icon]')!;
    const originalShape = icon().getAttribute('class');
    expect(outline()).toHaveAttribute('stroke', '#f8fafc');
    expect(outline()).toHaveAttribute('fill', 'none');
    expect(outline()).toHaveAttribute('aria-hidden', 'true');
    expect(Number(outline().getAttribute('stroke-width'))).toBeGreaterThan(Number(icon().getAttribute('stroke-width')));
    expect(icon()).toHaveAttribute('stroke', '#111111');
    expect(icon()).toHaveAttribute('fill', '#111111');
    expect(icon()).toHaveAttribute('fill-opacity', '0.25');

    rerender(<StickerElement id="player" color="#fefefe" />);
    expect(outline()).toHaveAttribute('stroke', '#0f172a');
    expect(icon()).toHaveAttribute('stroke', '#fefefe');
    expect(icon()).toHaveAttribute('fill', '#fefefe');
    expect(icon()).toHaveAttribute('class', originalShape!);
  });

  it('uses the actual theme color for players without a specified color', () => {
    document.documentElement.style.setProperty('--c-txt-secondary', '240 240 240');
    const color = 'rgb(var(--c-txt-secondary))';
    const { container, rerender } = render(<StickerElement id="player" color={color} />);
    expect(container.querySelector('[data-sticker-outline]')).toHaveAttribute('stroke', '#0f172a');

    document.documentElement.style.setProperty('--c-txt-secondary', '20 20 20');
    rerender(<StickerElement id="player" color={color} />);
    expect(container.querySelector('[data-sticker-outline]')).toHaveAttribute('stroke', '#f8fafc');
    expect(container.querySelector('[data-sticker-icon]')).toHaveAttribute('stroke', color);
  });
});
