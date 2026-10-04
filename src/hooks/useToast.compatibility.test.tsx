import React from 'react';
import { act, cleanup, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './useToast';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows successive notifications when crypto.randomUUID is unavailable', () => {
  vi.stubGlobal('crypto', {});
  const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

  act(() => {
    result.current.showToast({ message: 'First notification' });
    result.current.showToast({ message: 'Second notification' });
  });

  expect(screen.getByText('First notification')).toBeInTheDocument();
  expect(screen.getByText('Second notification')).toBeInTheDocument();
});
