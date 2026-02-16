
import { useState, useRef, useEffect } from 'react';
import { GameSession, GameTemplate, SavedListItem } from '../../../types';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  savedPlayers: SavedListItem[]; // Renamed from playerHistory
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdateSavedPlayer: (name: string, uuid?: string) => void; // Renamed from onUpdatePlayerHistory
  onExit: () => void;
  onResetScores: () => void;
  baseImage?: string | null; // [New] Added to check texture mode
}

export interface ScreenshotLayout {
  itemWidth: number;
  playerWidths: Record<string, number>;
  playerHeaderHeight: number;
  rowHeights: Record<string, number>;
  totalRowHeight?: number; // New field
}

export interface UIState {
  editingCell: { playerId: string; colId: string } | null;
  editingPlayerId: string | null;
  editingColumn: GameTemplate['columns'][0] | null;
  isEditingTitle: boolean;
  isGameSettingsOpen: boolean; // [New] Toggle for Game Settings Modal
  showResetConfirm: boolean;
  isSessionExitModalOpen: boolean; 
  columnToDelete: string | null;
  isAddColumnModalOpen: boolean;
  showShareMenu: boolean;
  screenshotModal: {
    isOpen: boolean;
    mode: 'full' | 'simple';
    layout: ScreenshotLayout | null;
  };
  isPhotoGalleryOpen: boolean;
  
  // [New] Controls gallery behavior (e.g. auto open lightbox with overlay)
  galleryParams?: {
      mode: 'default' | 'lightbox_overlay';
  };

  isImageUploadModalOpen: boolean;
  
  isScannerOpen: boolean;
  scannerInitialImage: string | null;
  scannerFixedRatio?: number;
  
  isGeneralCameraOpen: boolean; // [New] Camera for photo gallery

  isTextureMapperOpen: boolean; // [New] Grid Editor State
  
  isToolboxOpen: boolean; // [New] Toolbox Sticky State

  advanceDirection: 'horizontal' | 'vertical';
  overwriteMode: boolean;
  isInputFocused: boolean;
  tempPlayerName: string;
  isEditMode: boolean; 
  previewValue: any; 
}

export const useSessionState = (props: SessionViewProps) => {
  const [uiState, setUiState] = useState<UIState>(() => {
    const initialEditMode = typeof window !== 'undefined' ? localStorage.getItem('app_edit_mode') !== 'false' : true;
    const savedDirection = (typeof window !== 'undefined' ? localStorage.getItem('sm_pref_advance_direction') : null) as 'horizontal' | 'vertical';
    
    // [Feature] Auto-open first player editor for Zero-Column templates (Simple Counter Mode)
    // Behavior: Open the panel fully (editingPlayerId set) but do NOT focus input (isInputFocused false)
    // so the user sees the full interface (Color Palette, History).
    let initialEditingPlayerId = null;
    let initialTempName = '';
    
    if (props.template.columns.length === 0 && props.session.players.length > 0) {
        const firstPlayer = props.session.players[0];
        initialEditingPlayerId = firstPlayer.id;
        initialTempName = firstPlayer.name;
    }

    return {
      editingCell: null,
      editingPlayerId: initialEditingPlayerId,
      editingColumn: null,
      isEditingTitle: false,
      isGameSettingsOpen: false, // [New]
      showResetConfirm: false,
      isSessionExitModalOpen: false,
      columnToDelete: null,
      isAddColumnModalOpen: false,
      showShareMenu: false,
      screenshotModal: { isOpen: false, mode: 'full', layout: null },
      isPhotoGalleryOpen: false,
      galleryParams: { mode: 'default' }, // Default init
      isImageUploadModalOpen: false,
      isScannerOpen: false,
      scannerInitialImage: null,
      isGeneralCameraOpen: false, // Default false
      isTextureMapperOpen: false, // Default closed
      isToolboxOpen: false, // [New] Default closed
      advanceDirection: savedDirection || 'vertical', // Default to vertical if no preference saved
      overwriteMode: true,
      isInputFocused: false,
      tempPlayerName: initialTempName,
      isEditMode: initialEditMode,
      previewValue: 0,
    };
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const totalBarScrollRef = useRef<HTMLDivElement>(null);
  
  const gridContentRef = useRef<HTMLDivElement>(null);
  const totalContentRef = useRef<HTMLDivElement>(null);
  
  // --- Effects for state transitions ---

  useEffect(() => {
    localStorage.setItem('app_edit_mode', String(uiState.isEditMode));
  }, [uiState.isEditMode]);

  useEffect(() => {
    if (uiState.editingCell) {
      setUiState(prev => ({ ...prev, overwriteMode: true }));
    }
  }, [uiState.editingCell?.playerId, uiState.editingCell?.colId]);
  
  useEffect(() => {
    if (uiState.editingPlayerId) {
        const p = props.session.players.find(pl => pl.id === uiState.editingPlayerId);
        if (p) {
            setUiState(prev => {
                // Optimization: If name is already set (e.g. from init), don't update
                if (prev.tempPlayerName === p.name) return prev;
                return { ...prev, tempPlayerName: p.name, isInputFocused: false };
            });
        }
    }
  }, [uiState.editingPlayerId, props.session.players]);

  // [Fix] Scroll active cell (or player header) into view
  // Strategy: Calculate target X and Y separately, then issue ONE scrollTo command.
  useEffect(() => {
    const scrollToActive = () => {
      if (!tableContainerRef.current) return;
      const container = tableContainerRef.current;

      // Initialize targets with current position (default = don't move)
      let nextLeft = container.scrollLeft;
      let nextTop = container.scrollTop;

      // --- 1. Horizontal Calculation (X) ---
      const activePlayerId = uiState.editingPlayerId || uiState.editingCell?.playerId;
      const targetPlayerHeaderEl = activePlayerId ? document.getElementById(`header-${activePlayerId}`) : null;

      if (targetPlayerHeaderEl) {
          const headerRow = targetPlayerHeaderEl.parentElement;
          const stickyLabel = headerRow?.children[0] as HTMLElement;
          const stickyWidth = stickyLabel ? stickyLabel.offsetWidth : 70;

          // Align the PREVIOUS player to the sticky edge to provide context
          const previousPlayerEl = targetPlayerHeaderEl.previousElementSibling as HTMLElement | null;
          
          // If previous is the sticky label itself (index 0), we stick to current
          const alignTarget = (previousPlayerEl && previousPlayerEl !== stickyLabel) ? previousPlayerEl : targetPlayerHeaderEl;
          
          // Simple logic: scroll position = element's left position - sticky column width
          nextLeft = Math.max(0, alignTarget.offsetLeft - stickyWidth);
      }

      // --- 2. Vertical Calculation (Y) ---
      let targetRowEl: HTMLElement | null = null;

      if (uiState.editingPlayerId) {
          // Editing Header -> Force Top
          nextTop = 0;
      } else if (uiState.editingCell) {
          if (uiState.editingCell.colId !== '__TOTAL__') {
              let effectiveColId = uiState.editingCell.colId;
              
              // Handle Overlays: Find the host row if the column is an overlay
              if (!document.getElementById(`row-${effectiveColId}`)) {
                  const allCols = props.template.columns;
                  const currentIndex = allCols.findIndex(c => c.id === effectiveColId);
                  for (let i = currentIndex - 1; i >= 0; i--) {
                      if ((allCols[i].displayMode || 'row') === 'row') {
                          effectiveColId = allCols[i].id;
                          break;
                      }
                  }
              }
              targetRowEl = document.getElementById(`row-${effectiveColId}`);
          }

          if (targetRowEl) {
              const headerEl = document.getElementById('live-player-header-row');
              const headerHeight = headerEl ? headerEl.offsetHeight : 48;
              
              // Align the PREVIOUS row to the bottom of the header
              const previousRowElement = targetRowEl.previousElementSibling as HTMLElement | null;
              if (previousRowElement) {
                  nextTop = previousRowElement.offsetTop - headerHeight;
              } else {
                  nextTop = targetRowEl.offsetTop - headerHeight;
              }
          }
      }

      // --- 3. Execute Scroll (Single Command) ---
      // Only scroll if there is a meaningful difference to avoid jitter
      if (Math.abs(nextLeft - container.scrollLeft) > 2 || Math.abs(nextTop - container.scrollTop) > 2) {
          container.scrollTo({
              left: nextLeft,
              top: nextTop,
              behavior: 'smooth'
          });
      }
    };

    // Use a small timeout to allow layout to stabilize
    const timer = setTimeout(scrollToActive, 100);
    return () => clearTimeout(timer);

  }, [uiState.editingCell, uiState.editingPlayerId, props.template.columns]);
  
  // --- Derived State ---
  // [Smart Layout] Identify if the list is "Short"
  // Conditions:
  // 1. Not in Texture Mode (baseImage is null)
  // 2. Column count is small (< 5)
  const isShortList = !props.baseImage && props.template.columns.length < 5;

  const isPanelOpen = uiState.editingCell !== null || uiState.editingPlayerId !== null;
  
  // [Updated] If short list OR toolbox is open, force the panel space to be open (40vh) to push the Total Bar up.
  // This effectively centers the Total Bar and removes the gap.
  const panelHeight = (isPanelOpen || isShortList || uiState.isToolboxOpen)
    ? (uiState.isInputFocused ? '112px' : '40vh')
    : '0px';

  return {
    uiState,
    setUiState,
    panelHeight,
    isShortList, // Export for InputPanel to know when to show placeholder
    tableContainerRef,
    totalBarScrollRef,
    gridContentRef,
    totalContentRef,
  };
};
