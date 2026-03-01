import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDashboardActions } from './useDashboardActions';
import type { GameTemplate } from '../../../types';

const hoisted = vi.hoisted(() => {
  const showToast = vi.fn();
  const t = vi.fn((key: string) => key);
  const writeText = vi.fn<[string], Promise<void>>(async () => undefined);

  return {
    showToast,
    t,
    writeText,
  };
});

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: hoisted.showToast }),
}));

vi.mock('../../../i18n/dashboard', () => ({
  useDashboardTranslation: () => ({ t: hoisted.t }),
}));

vi.mock('../../../hooks/useGoogleDrive', () => ({
  useGoogleDrive: () => ({
    handleBackup: vi.fn(async () => null),
    performFullBackup: vi.fn(async () => true),
    performFullRestore: vi.fn(async () => true),
  }),
}));

describe('useDashboardActions.handleCopyJSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: hoisted.writeText },
      configurable: true,
    });
  });

  it('copies overridden template JSON from full override template (not builtin source)', async () => {
    const overriddenFullTemplate: GameTemplate = {
      id: 'override_tpl_1',
      sourceTemplateId: 'Built-in-Agricola',
      name: 'Agricola (Modified)',
      columns: [
        {
          id: 'new_col',
          name: 'House Rule Bonus',
          formula: 'a1',
          inputType: 'keypad',
          isScoring: true,
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    };

    const partialSystemCardTemplate = {
      id: 'override_tpl_1',
      sourceTemplateId: 'Built-in-Agricola',
      name: 'Agricola (Modified)',
      columns: [],
      createdAt: 1,
    } as GameTemplate;

    const onGetFullTemplate = vi.fn(async (id: string) => {
      if (id === 'override_tpl_1') return overriddenFullTemplate;
      return null;
    });

    const { result } = renderHook(() =>
      useDashboardActions({
        isAutoConnectEnabled: false,
        onGetFullTemplate,
        onTemplateSave: vi.fn(),
        onImportHistory: vi.fn(),
        onImportSession: vi.fn(),
        onGetLocalData: vi.fn(async () => ({})),
        onTogglePin: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleCopyJSON(partialSystemCardTemplate, { stopPropagation: vi.fn() } as unknown as React.MouseEvent);
    });

    expect(onGetFullTemplate).toHaveBeenCalledWith('override_tpl_1');
    expect(hoisted.writeText).toHaveBeenCalledTimes(1);

    const copiedJson = hoisted.writeText.mock.calls[0][0];
    const copiedObject = JSON.parse(copiedJson);
    expect(copiedObject.id).toBe('override_tpl_1');
    expect(copiedObject.sourceTemplateId).toBe('Built-in-Agricola');
    expect(copiedObject.columns).toHaveLength(1);
    expect(copiedObject.columns[0].id).toBe('new_col');

    await waitFor(() => {
      expect(hoisted.showToast).toHaveBeenCalledWith({ message: 'msg_json_copied', type: 'success' });
    });
  });
});
