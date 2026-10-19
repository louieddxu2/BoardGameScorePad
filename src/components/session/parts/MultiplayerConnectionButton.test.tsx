import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageContext } from '../../../i18n';
import MultiplayerConnectionButton from './MultiplayerConnectionButton';

type Props = React.ComponentProps<typeof MultiplayerConnectionButton>;
const buttonView = (props: Props) => (
  <LanguageContext.Provider value={{ language: 'zh-TW', setLanguage: () => undefined }}>
    <MultiplayerConnectionButton {...props} />
  </LanguageContext.Provider>
);

describe('multiplayer connection button', () => {
  it('uses matching top-right status icons without inline labels or changing either role\'s actions', () => {
    const onClick = vi.fn();
    const props: Props = { onClick, onMouseDown: event => event.preventDefault(), connectionCount: 2 };
    const { getByRole, rerender } = render(buttonView(props));
    for (const role of ['host', 'player'] as const) {
      for (const [status, label, color] of [
        ['connected', '已連線', 'text-status-success'],
        ['connecting', '連線中', 'text-status-info'],
        ['reconnecting', '重新連線', 'text-status-warning'],
        ['syncing', '同步中', 'text-status-warning'],
        ['disconnected', '已斷線', 'text-status-danger'],
      ] as const) {
        rerender(buttonView({ ...props, role, status }));
        const button = getByRole('button');
        expect(button).not.toHaveTextContent(label);
        expect(button).toHaveAccessibleName(new RegExp(`${role === 'host' ? '房主' : '連線玩家'} · ${label}`));
        expect(button).toHaveClass(color);
        const badge = button.querySelector('[data-multiplayer-status]')!;
        expect(badge).toHaveAttribute('data-multiplayer-status', status);
        expect(badge).toHaveClass('-right-1', '-top-1');
        expect(badge.querySelector('svg')).toHaveClass(status === 'connected' ? 'lucide-check'
          : status === 'disconnected' ? 'lucide-circle-alert' : 'lucide-refresh-cw');
        expect(button.querySelector('.lucide-users-round')).not.toBeNull();
        const count = button.querySelector('[data-multiplayer-count]');
        if (role === 'host') expect(count).toHaveClass('-right-1', '-bottom-1');
        else expect(count).toBeNull();
        fireEvent.click(button);
      }
    }
    expect(onClick).toHaveBeenCalledTimes(10);
  });

  it('distinguishes an empty open room from board sync progress and interruptions', () => {
    const props: Props = { role: 'host', status: 'connecting', connectionCount: 0,
      onClick: vi.fn(), onMouseDown: vi.fn() };
    const { getByRole, rerender } = render(buttonView(props));
    expect(getByRole('button')).toHaveAccessibleName(/等待加入/);
    expect(getByRole('button').querySelector('[data-multiplayer-status] svg')).toHaveClass('lucide-circle');
    for (const [boardSyncStatus, label] of [
      ['synced', '等待加入'], ['pending', '同步中'], ['syncing', '同步中'], ['error', '同步失敗'],
    ] as const) {
      rerender(buttonView({ ...props, boardSyncStatus }));
      expect(getByRole('button')).toHaveAccessibleName(new RegExp(label));
      expect(getByRole('button')).not.toHaveTextContent(label);
      if (boardSyncStatus === 'error') {
        expect(getByRole('button')).toHaveClass('text-status-danger');
        expect(getByRole('button').querySelector('[data-multiplayer-status] svg')).toHaveClass('lucide-circle-alert');
      }
    }
    rerender(buttonView({ ...props, status: 'reconnecting', boardSyncStatus: 'error' }));
    expect(getByRole('button')).toHaveAccessibleName(/重新連線/);
    rerender(buttonView({ ...props, status: 'connected', connectionCount: 100 }));
    expect(getByRole('button')).toHaveAccessibleName(/已連線/);
    expect(getByRole('button')).toHaveTextContent('99+');
    expect(getByRole('button')).toHaveAccessibleName(/已連線 100 台裝置/);
  });

  it('keeps inactive and preview buttons neutral and restores neutrality after leaving', () => {
    const props: Props = { idleLabel: 'Open room', onClick: vi.fn(), onMouseDown: vi.fn() };
    const { getByRole, rerender } = render(buttonView(props));
    expect(getByRole('button', { name: 'Open room' })).toHaveClass('text-txt-muted');
    expect(getByRole('button').textContent).toBe('');
    rerender(buttonView({ ...props, role: 'player', status: 'connected' }));
    expect(getByRole('button').querySelector('[data-multiplayer-status]')).not.toBeNull();
    rerender(buttonView({ ...props, previewPlayerNumber: 2 }));
    expect(getByRole('button', { name: 'Open room' })).toHaveTextContent('2');
    expect(getByRole('button')).toHaveClass('text-txt-muted');
    expect(getByRole('button')).not.toHaveTextContent('已連線');
    expect(getByRole('button').querySelector('[data-multiplayer-status]')).toBeNull();
  });
});
