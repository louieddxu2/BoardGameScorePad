import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppSessionActions } from './useAppSessionActions';

vi.mock('./useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../i18n/app', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));

const createOptions = (overrides: Record<string, unknown> = {}) => ({
  appData: {
    activeSessions: [{ id: 'session-1', templateId: 'template-1', status: 'active' }],
    resumeSession: vi.fn(async () => true),
  } as any,
  activeMultiplayerRoom: null,
  isMultiplayerTransitioning: false,
  releaseHostMultiplayerRoom: vi.fn(),
  releaseParticipantMultiplayerRoom: vi.fn(),
  releaseMultiplayerRoomForSession: vi.fn(),
  tryRestoreMultiplayerRoom: vi.fn(async () => true),
  enterActiveSession: vi.fn(),
  prepareMultiplayerSessionExit: vi.fn(),
  finalizeMultiplayerSessionExit: vi.fn(),
  transitionToDashboard: vi.fn(),
  captureAiTemplateForSharing: vi.fn(),
  shouldTriggerIOSPwaGuide: vi.fn(() => false),
  setView: vi.fn(),
  setPendingTemplate: vi.fn(),
  setEditorInitialName: vi.fn(),
  setIsIOSPwaGuideVisible: vi.fn(),
  ...overrides,
} as any);

describe('useAppSessionActions multiplayer resume', () => {
  it('stays on the dashboard when another tab supersedes multiplayer restoration', async () => {
    const enterActiveSession = vi.fn();
    const options = createOptions({
      enterActiveSession,
      tryRestoreMultiplayerRoom: vi.fn(async () => false),
    });
    const { result } = renderHook(() => useAppSessionActions(options));

    await act(async () => {
      await result.current.handleDirectResume('template-1');
    });

    expect(options.appData.resumeSession).toHaveBeenCalledTimes(1);
    expect(enterActiveSession).not.toHaveBeenCalled();
  });

  it('serializes repeated clicks on the same active-session card', async () => {
    let finishResume!: (value: boolean) => void;
    const resumeSession = vi.fn(() => new Promise<boolean>((resolve) => { finishResume = resolve; }));
    const options = createOptions({
      appData: {
        activeSessions: [{ id: 'session-1', templateId: 'template-1', status: 'active' }],
        resumeSession,
      },
    });
    const { result } = renderHook(() => useAppSessionActions(options));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.handleDirectResume('template-1');
      second = result.current.handleDirectResume('template-1');
    });
    expect(resumeSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishResume(true);
      await Promise.all([first, second]);
    });

    expect(options.tryRestoreMultiplayerRoom).toHaveBeenCalledTimes(1);
    expect(options.enterActiveSession).toHaveBeenCalledTimes(1);
  });
});
