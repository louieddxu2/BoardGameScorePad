import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDashboardData } from './useDashboardData';

describe('useDashboardData recent shortcuts', () => {
  it('creates a lightweight simple-template fallback for a missing recent game', () => {
    const { result } = renderHook(() => useDashboardData({
      userTemplates: [],
      systemTemplates: [],
      pinnedIds: [],
      recentlyPlayedGames: [{ templateId: 'missing-template', gameName: 'Recent Game', bggId: '12345' }],
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    expect(result.current.recentTemplates).toHaveLength(1);
    expect(result.current.recentTemplates[0]).toMatchObject({
      needsResolution: true,
      template: {
        id: 'missing-template',
        name: 'Recent Game',
        bggId: '12345',
        columns: []
      }
    });
  });

  it('uses the loaded template when it is already available', () => {
    const template = { id: 'template-1', name: 'Current Name', columns: [], createdAt: 1 };
    const { result } = renderHook(() => useDashboardData({
      userTemplates: [template],
      systemTemplates: [],
      pinnedIds: [],
      recentlyPlayedGames: [{ templateId: 'template-1', gameName: 'Historical Name' }],
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    expect(result.current.recentTemplates).toEqual([{ template, needsResolution: false }]);
  });
});
