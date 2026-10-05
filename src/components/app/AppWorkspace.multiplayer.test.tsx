import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n';
import { AppView } from '../../types';
import { _resetActiveCountForTesting } from '../../hooks/useModalBackHandler';
import AppWorkspace from './AppWorkspace';

// Other screens are outside this test; retain the real room modal and its history handling.
vi.mock('../dashboard/Dashboard', () => ({ default: () => null }));
vi.mock('../editor/TemplateEditor', () => ({ default: () => null }));
vi.mock('../history/HistoryReviewView', () => ({ default: () => null }));
vi.mock('../dashboard/modals/GameSetupModal', () => ({ default: () => null }));
vi.mock('../modals/InAppBrowserGuide', () => ({ InAppBrowserGuide: () => null }));
vi.mock('../modals/IOSPwaGuide', () => ({ IOSPwaGuide: () => null }));
vi.mock('../session/SessionView', () => ({
  default: ({ onOpenMultiplayerRoom }: { onOpenMultiplayerRoom?: () => void }) => (
    <button onClick={onOpenMultiplayerRoom}>Multiplayer</button>
  ),
}));

beforeEach(() => {
  localStorage.setItem('app_language', 'en');
  _resetActiveCountForTesting();
});

afterEach(() => vi.restoreAllMocks());

it('routes the entry to the introduction without a host room, then shows QR in the same dialog after confirmation', () => {
  type Props = React.ComponentProps<typeof AppWorkspace>;
  const handleOpenMultiplayerRoom = vi.fn();
  const handleCreateMultiplayerRoom = vi.fn();
  const handleCloseMultiplayerRoomModal = vi.fn();
  const multiplayer = {
    activeMultiplayerRoom: null,
    activeMultiplayerRoomState: null,
    isMultiplayerRoomModalOpen: false,
    isOpeningMultiplayerRoom: false,
    hasMultiplayerRoomOpenError: false,
    multiplayerJoinUrl: '',
    handleOpenMultiplayerRoom,
    handleCreateMultiplayerRoom,
    handleCloseMultiplayerRoomModal,
    handlePublishMultiplayerBoardUpdate: vi.fn(),
  } as unknown as Props['multiplayer'];
  const props: Props = {
    view: AppView.ACTIVE_SESSION,
    appData: { currentSession: { id: 'session-1' }, activeTemplate: { id: 'template-1' } } as Props['appData'],
    pendingTemplate: null, pendingSessionPreview: null,
    isCloudImporting: false, showLandscapeOverlay: false, zoomLevel: 1,
    isInstalled: false, canInstall: false, isIOSPwaGuideVisible: false,
    setView: vi.fn(), setPendingTemplate: vi.fn(), setEditorInitialName: vi.fn(),
    setIsIOSPwaGuideVisible: vi.fn(), handleInstallClick: vi.fn(), tApp: (key) => key,
    actions: { handleCloseMultiplayerRoom: vi.fn() } as unknown as Props['actions'],
    multiplayer,
  };
  const workspace = () => <LanguageProvider><AppWorkspace {...props} /></LanguageProvider>;
  const { rerender } = render(workspace());
  fireEvent.click(screen.getByRole('button', { name: 'Multiplayer' }));
  expect(handleOpenMultiplayerRoom).toHaveBeenCalledTimes(1);
  expect(handleCreateMultiplayerRoom).not.toHaveBeenCalled();

  const pushState = vi.spyOn(window.history, 'pushState');
  props.multiplayer = { ...multiplayer, isMultiplayerRoomModalOpen: true };
  rerender(workspace());
  const dialog = screen.getByRole('dialog', { name: 'Score together' });
  fireEvent.click(screen.getByRole('button', { name: 'Open room' }));
  expect(handleCreateMultiplayerRoom).toHaveBeenCalledTimes(1);
  props.multiplayer = { ...props.multiplayer, isOpeningMultiplayerRoom: true };
  rerender(workspace());
  expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
  props.multiplayer = {
    ...props.multiplayer,
    isOpeningMultiplayerRoom: false,
    activeMultiplayerRoom: { roomId: 'room-1', role: 'host' },
    multiplayerJoinUrl: 'https://example.test/?room=room-1',
  };
  rerender(workspace());

  expect(screen.getByRole('dialog')).toBe(dialog);
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(pushState).toHaveBeenCalledTimes(1);
  act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(handleCloseMultiplayerRoomModal).toHaveBeenCalledTimes(1);
  expect(props.actions.handleCloseMultiplayerRoom).not.toHaveBeenCalled();
});
