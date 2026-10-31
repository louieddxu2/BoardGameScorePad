import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ConfirmationModal from './ConfirmationModal';
import { LanguageProvider } from '../../i18n';

it('scrolls long messages inside the dialog and keeps the actions outside the scroll area', () => {
  const message = Array.from({ length: 80 }, (_, index) => `line ${index} ${'very-long-file-name'.repeat(8)}.zip`).join('\n');
  render(<LanguageProvider><ConfirmationModal isOpen title="Replace all data?" message={message} confirmText="Replace" cancelText="Cancel"
    onConfirm={vi.fn()} onCancel={vi.fn()} isDangerous /></LanguageProvider>);
  const scroller = screen.getByTestId('confirmation-message');
  expect(scroller).toHaveClass('min-h-0', 'overflow-y-auto', '[overflow-wrap:anywhere]');
  expect(scroller.closest('.modal-container')).toHaveClass('max-h-full');
  for (const name of ['Replace', 'Cancel']) {
    const button = screen.getByRole('button', { name });
    expect(scroller).not.toContainElement(button);
    expect(button.parentElement).toHaveClass('shrink-0');
  }
});
