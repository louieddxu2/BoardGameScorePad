import { useState, useRef, useEffect } from 'react';
import { GameSession, GameTemplate } from '../../../types';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onExit: () => void;
  onResetScores: () => void;
}

export interface UIState {
  editingCell: { playerId: string; colId: string } | null;
  editingPlayerId: string | null;
  editingColumn: GameTemplate['columns'][0] | null;
  isEditingTitle: boolean;
  showResetConfirm: boolean;
  showExitConfirm: boolean;
  columnToDelete: string | null;
  isAddColumnModalOpen: boolean;
  showShareMenu: boolean;
  isCopying: boolean;
  advanceDirection: 'horizontal' | 'vertical';
  overwriteMode: boolean;
  isInputFocused: boolean;
  tempPlayerName: string;
}

export const useSessionState = (props: SessionViewProps) => {
  const [uiState, setUiState] = useState<UIState>({
    editingCell: null,
    editingPlayerId: null,
    editingColumn: null,
    isEditingTitle: false,
    showResetConfirm: false,
    showExitConfirm: false,
    columnToDelete: null,
    isAddColumnModalOpen: false,
    showShareMenu: false,
    isCopying: false,
    advanceDirection: 'horizontal',
    overwriteMode: true,
    isInputFocused: false,
    tempPlayerName: '',
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const totalBarScrollRef = useRef<HTMLDivElement>(null);
  
  // --- Effects for state transitions ---

  // When active cell changes, enable overwrite mode
  useEffect(() => {
    if (uiState.editingCell) {
      setUiState(prev => ({ ...prev, overwriteMode: true }));
    }
  }, [uiState.editingCell?.playerId, uiState.editingCell?.colId]);
  
  // When editing a player, load their name into temp state
  useEffect(() => {
    if (uiState.editingPlayerId) {
        const p = props.session.players.find(pl => pl.id === uiState.editingPlayerId);
        if (p) {
            setUiState(prev => ({ ...prev, tempPlayerName: p.name, isInputFocused: false }));
        }
    }
  }, [uiState.editingPlayerId, props.session.players]);

  // Scroll active cell into view
  useEffect(() => {
    if (uiState.editingCell) {
      requestAnimationFrame(() => {
        if (!tableContainerRef.current) return;
        const container = tableContainerRef.current;
        const headerEl = container.querySelector<HTMLElement>('.sticky.top-0');
        const headerHeight = headerEl ? headerEl.offsetHeight : 48;
        const activeColumnIndex = props.template.columns.findIndex(c => c.id === uiState.editingCell!.colId);
        if (activeColumnIndex === -1) return;
        
        const targetRowElement = document.getElementById(`row-${uiState.editingCell!.colId}`);
        if (targetRowElement) {
          const rowTop = targetRowElement.offsetTop;
          container.scrollTo({ top: rowTop - headerHeight, behavior: 'smooth' });
        }
      });
    }
  }, [uiState.editingCell, props.template.columns]);
  
  // --- Derived State ---
  const isPanelOpen = uiState.editingCell !== null || uiState.editingPlayerId !== null;
  const panelHeight = isPanelOpen
    ? (uiState.editingPlayerId && uiState.isInputFocused) ? 'auto' : '45vh'
    : '0px';

  return {
    uiState,
    setUiState,
    panelHeight,
    tableContainerRef,
    totalBarScrollRef,
  };
};
