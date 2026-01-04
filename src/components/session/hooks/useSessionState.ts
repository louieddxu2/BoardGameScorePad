
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

export interface ScreenshotLayout {
  itemWidth: number;
  playerWidths: Record<string, number>;
  playerHeaderHeight: number;
  rowHeights: Record<string, number>;
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
  screenshotModal: {
    isOpen: boolean;
    mode: 'full' | 'simple';
    layout: ScreenshotLayout | null;
  };
  advanceDirection: 'horizontal' | 'vertical';
  overwriteMode: boolean;
  isInputFocused: boolean;
  tempPlayerName: string;
  isEditMode: boolean; // New state for Edit vs Play mode
  previewValue: any; // New state for buffered input preview
}

export const useSessionState = (props: SessionViewProps) => {
  const [uiState, setUiState] = useState<UIState>(() => {
    // Read initial edit mode from local storage.
    const initialEditMode = typeof window !== 'undefined' ? localStorage.getItem('app_edit_mode') !== 'false' : true;
    
    return {
      editingCell: null,
      editingPlayerId: null,
      editingColumn: null,
      isEditingTitle: false,
      showResetConfirm: false,
      showExitConfirm: false,
      columnToDelete: null,
      isAddColumnModalOpen: false,
      showShareMenu: false,
      screenshotModal: { isOpen: false, mode: 'full', layout: null },
      advanceDirection: 'horizontal',
      overwriteMode: true,
      isInputFocused: false,
      tempPlayerName: '',
      isEditMode: initialEditMode,
      previewValue: 0,
    };
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const totalBarScrollRef = useRef<HTMLDivElement>(null);
  
  // New refs for Width Synchronization
  const gridContentRef = useRef<HTMLDivElement>(null);
  const totalContentRef = useRef<HTMLDivElement>(null);
  
  // --- Effects for state transitions ---

  // Persist Edit Mode whenever it changes
  useEffect(() => {
    localStorage.setItem('app_edit_mode', String(uiState.isEditMode));
  }, [uiState.isEditMode]);

  // When active cell changes, enable overwrite mode and reset preview
  useEffect(() => {
    if (uiState.editingCell) {
      setUiState(prev => ({ ...prev, overwriteMode: true, previewValue: 0 }));
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

  // Scroll active cell (or player header) into view
  useEffect(() => {
    const scrollToActive = () => {
      if (!tableContainerRef.current) return;
      const container = tableContainerRef.current;

      // Case 1: Editing Player Name (Header) -> Scroll to absolute Top
      if (uiState.editingPlayerId) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Case 2: Editing Cell
      if (uiState.editingCell) {
        const colIndex = props.template.columns.findIndex(c => c.id === uiState.editingCell!.colId);

        // Case 2a: First Data Row -> Scroll to absolute Top
        if (colIndex === 0) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        // Case 2b: Middle/Bottom Rows -> Scroll Previous Row to Top (Context)
        const headerEl = document.getElementById('live-player-header-row');
        const headerHeight = headerEl ? headerEl.offsetHeight : 48;
        
        const targetRowElement = document.getElementById(`row-${uiState.editingCell.colId}`);
        if (targetRowElement) {
          const previousRowElement = targetRowElement.previousElementSibling as HTMLElement | null;
          
          if (previousRowElement) {
            const previousRowTop = previousRowElement.offsetTop;
            container.scrollTo({ top: previousRowTop - headerHeight, behavior: 'smooth' });
          } else {
            container.scrollTo({ top: targetRowElement.offsetTop - headerHeight, behavior: 'smooth' });
          }
        }
      }
    };

    const timer = setTimeout(scrollToActive, 50);
    return () => clearTimeout(timer);

  }, [uiState.editingCell, uiState.editingPlayerId, props.template.columns]);
  
  // --- Derived State ---
  const isPanelOpen = uiState.editingCell !== null || uiState.editingPlayerId !== null;
  
  const panelHeight = isPanelOpen 
    ? (uiState.isInputFocused ? '112px' : '40vh')
    : '0px';

  return {
    uiState,
    setUiState,
    panelHeight,
    tableContainerRef,
    totalBarScrollRef,
    gridContentRef,
    totalContentRef,
  };
};
