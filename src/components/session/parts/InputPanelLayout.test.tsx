import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InputPanelLayout from './InputPanelLayout';

describe('InputPanelLayout', () => {
  it.each([false, true])(
    'fills the remaining input content box without percentage-height resolution (compact: %s)',
    (isCompact) => {
      const { container } = render(
        <div className="relative">
          <InputPanelLayout onNext={vi.fn()} isCompact={isCompact}>
            <div>content</div>
          </InputPanelLayout>
        </div>,
      );

      const layout = container.querySelector('[data-input-panel-layout="true"]');

      expect(layout).toHaveClass('absolute', 'inset-0');
      expect(layout).not.toHaveClass('h-full');
    },
  );

  it('lets the full-mode grid size the right-side next button without h-full', () => {
    const { container } = render(
      <div className="relative">
        <InputPanelLayout onNext={vi.fn()} sidebarContent={<div>sidebar</div>}>
          <div>content</div>
        </InputPanelLayout>
      </div>,
    );

    const nextButton = container.querySelector('[data-input-panel-next="true"]');

    expect(nextButton).toBeInTheDocument();
    expect(nextButton).not.toHaveClass('h-full');
  });
});
