import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession, GameTemplate } from '../../../types';
import type { SessionTranslationKey } from '../../../i18n/session';
import { consumePendingAiShare, hasPendingAiShare } from '../../../utils/pendingAiShare';
import { useSessionTemplateApplication } from './useSessionTemplateApplication';

const { putPreference } = vi.hoisted(() => ({ putPreference: vi.fn() }));
vi.mock('../../../db', () => ({ db: { templatePrefs: { put: putPreference } } }));

const makeOptions = () => {
  const template: GameTemplate = {
    id: 'application-template', name: 'Original', createdAt: 1,
    columns: [{ id: 'old', name: 'Old', formula: 'a1', inputType: 'keypad', isScoring: true }],
    defaultScoringRule: 'HIGHEST_WINS', description: 'Original description',
    supportedColors: ['#fff'], imageId: 'original-image', hasImage: true,
  };
  const session: GameSession = {
    id: 'application-session', templateId: template.id, name: 'Named session', startTime: 3,
    status: 'active', scoringRule: 'HIGHEST_WINS', winnerIds: ['p1'],
    players: [{ id: 'p1', name: 'Player', color: '#fff', scores: { old: { parts: [9] } }, totalScore: 9, bonusScore: 2 }],
  };
  return {
    session, template,
    onUpdateTemplate: vi.fn(async (next: GameTemplate) => ({ template: next, session: null as GameSession | null })),
    onUpdateSession: vi.fn(async (_next: GameSession) => undefined),
    setIsOnlineSearchOpen: vi.fn(), setIsAiPromptOpen: vi.fn(), showToast: vi.fn(),
    tSession: (key: SessionTranslationKey) => key,
  };
};

describe('useSessionTemplateApplication', () => {
  beforeEach(() => { putPreference.mockReset().mockResolvedValue(undefined); });
  afterEach(() => { consumePendingAiShare('application-template'); vi.restoreAllMocks(); });

  it('waits for the community template save before clearing inputs and recording the preference', async () => {
    const options = makeOptions();
    const payload: Partial<GameTemplate> = {
      id: 'remote-id', name: 'Remote', columns: [{ ...options.template.columns[0], id: 'new' }],
      defaultScoringRule: 'LOWEST_WINS', hasImage: false, description: '',
    };
    let finishTemplate!: (value: { template: GameTemplate; session: GameSession | null }) => void;
    options.onUpdateTemplate.mockImplementationOnce(() => new Promise(resolve => { finishTemplate = resolve; }));
    const { result } = renderHook(() => useSessionTemplateApplication(options));
    const application = result.current.handleApplyTemplate({ payload: JSON.stringify(payload) });

    const updated = options.onUpdateTemplate.mock.calls[0][0];
    expect(updated).toMatchObject({ ...options.template, columns: payload.columns, defaultScoringRule: 'LOWEST_WINS', hasImage: false });
    expect(options.onUpdateSession).not.toHaveBeenCalled();
    expect(putPreference).not.toHaveBeenCalled();
    expect(options.setIsOnlineSearchOpen).not.toHaveBeenCalled();

    await act(async () => { finishTemplate({ template: updated, session: null }); await application; });

    expect(options.onUpdateSession).toHaveBeenCalledExactlyOnceWith({
      ...options.session, scoringRule: 'LOWEST_WINS', winnerIds: [],
      players: [{ ...options.session.players[0], scores: {} }],
    });
    expect(putPreference).toHaveBeenCalledExactlyOnceWith({ templateId: options.template.id, lastPlayerCount: 1, updatedAt: expect.any(Number) });
    expect(options.setIsOnlineSearchOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(options.setIsAiPromptOpen).not.toHaveBeenCalled();
    expect(options.showToast).toHaveBeenCalledExactlyOnceWith({ message: 'toast_apply_template_success', type: 'success' });
    expect(hasPendingAiShare(options.template.id)).toBe(false);
    expect(options.session.players[0].scores.old.parts).toEqual([9]);
  });

  it('applies only AI columns and scoring rules, then marks the original template for sharing', async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useSessionTemplateApplication(options));
    const generated: Partial<GameTemplate> = {
      id: 'generated-id', name: 'Generated', imageId: 'generated-image', supportedColors: ['#000'],
      columns: [{ ...options.template.columns[0], id: 'generated' }], defaultScoringRule: 'COOP',
    };
    await act(async () => { await result.current.handleAiSuccess(generated); });

    expect(options.onUpdateTemplate).toHaveBeenCalledExactlyOnceWith({
      ...options.template, columns: generated.columns, defaultScoringRule: 'COOP', updatedAt: expect.any(Number),
    });
    expect(options.onUpdateSession).toHaveBeenCalledExactlyOnceWith({
      ...options.session, scoringRule: 'COOP', winnerIds: [], players: [{ ...options.session.players[0], scores: {} }],
    });
    expect(hasPendingAiShare(options.template.id)).toBe(true);
    expect(hasPendingAiShare('generated-id')).toBe(false);
    expect(putPreference).not.toHaveBeenCalled();
    expect(options.setIsAiPromptOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(options.setIsOnlineSearchOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(options.showToast).toHaveBeenCalledExactlyOnceWith({ message: 'toast_ai_apply_success', type: 'success' });
  });

  it('does not clear scores or report success for unusable input or a failed template save', async () => {
    const options = makeOptions();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useSessionTemplateApplication(options));
    await result.current.handleApplyTemplate({ payload: '{broken' });
    await result.current.handleApplyTemplate({ payload: null });
    await result.current.handleAiSuccess({ columns: [] });
    expect(options.onUpdateTemplate).not.toHaveBeenCalled();

    const error = new Error('template save failed');
    options.onUpdateTemplate.mockRejectedValueOnce(error);
    await expect(result.current.handleAiSuccess({ columns: options.template.columns })).rejects.toBe(error);
    expect(options.onUpdateSession).not.toHaveBeenCalled();
    expect(putPreference).not.toHaveBeenCalled();
    expect(options.setIsAiPromptOpen).not.toHaveBeenCalled();
    expect(options.setIsOnlineSearchOpen).not.toHaveBeenCalled();
    expect(options.showToast).not.toHaveBeenCalled();
    expect(hasPendingAiShare(options.template.id)).toBe(false);
    expect(options.session.players[0].scores.old.parts).toEqual([9]);
  });

  it('does not wait for preference persistence, but handles its asynchronous failure', async () => {
    const options = makeOptions();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let failPreference!: (error: Error) => void;
    putPreference.mockImplementationOnce(() => new Promise((_resolve, reject) => { failPreference = reject; }));
    const { result } = renderHook(() => useSessionTemplateApplication(options));
    await act(async () => { await result.current.handleApplyTemplate({ payload: { columns: options.template.columns } }); });
    expect(options.setIsOnlineSearchOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(options.showToast).toHaveBeenCalledExactlyOnceWith({ message: 'toast_apply_template_success', type: 'success' });

    const error = new Error('preference storage failed');
    await act(async () => { failPreference(error); await Promise.resolve(); });
    expect(logged).toHaveBeenCalledExactlyOnceWith('Failed to record prefs', error);
    expect(options.onUpdateSession).toHaveBeenCalledTimes(1);
  });
});
