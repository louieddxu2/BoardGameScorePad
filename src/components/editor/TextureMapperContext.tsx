
// FIX: Import React to bring the 'React' namespace into scope for types.
import React, { createContext, useContext } from 'react';
import { GameTemplate } from '../../types';

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export interface DraggedItemInfo {
  colId: string;
  x: number;
  y: number;
}

export interface GridBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TextureMapperContextType {
  // State
  hLines: number[];
  setHLines: React.Dispatch<React.SetStateAction<number[]>>;
  vLines: number[];
  setVLines: React.Dispatch<React.SetStateAction<number[]>>;
  sortedHLines: number[];
  sortedVLines: number[];
  
  // NEW: Boundaries
  gridBounds: GridBounds;
  setGridBounds: React.Dispatch<React.SetStateAction<GridBounds>>;
  
  headerSepIdx: number;
  setHeaderSepIdx: React.Dispatch<React.SetStateAction<number>>;
  totalSepIdx: number;
  setTotalSepIdx: React.Dispatch<React.SetStateAction<number>>;
  
  phase: 'grid' | 'structure';
  setPhase: React.Dispatch<React.SetStateAction<'grid' | 'structure'>>;
  
  importedTemplate: GameTemplate | null;
  setImportedTemplate: React.Dispatch<React.SetStateAction<GameTemplate | null>>;
  rowMapping: string[][];
  setRowMapping: React.Dispatch<React.SetStateAction<string[][]>>;
  rowCount: number;
  isMappingMode: boolean;

  transform: ViewTransform;
  
  // Derived Styles for overlays
  inverseScaleStyle: React.CSSProperties;
  inverseScaleYStyle: React.CSSProperties;
  inverseScaleXStyle: React.CSSProperties;
  hLineChildStyle: React.CSSProperties;
  vLineChildStyle: React.CSSProperties;

  // Interaction State & Handlers
  activeLine: { type: 'h' | 'v' | 'bound', index: number, boundType?: 'top'|'bottom'|'left'|'right' } | null;
  setActiveLine: React.Dispatch<React.SetStateAction<{ type: 'h' | 'v' | 'bound', index: number, boundType?: 'top'|'bottom'|'left'|'right' } | null>>;
  handlePointerDown: (e: React.MouseEvent | React.TouchEvent, type: 'line', payload?: any) => void;
  addLine: (type: 'h') => void;
  deleteLine: (type: 'h', index: number) => void;
  handleDropOnRow: (rowIndex: number, draggedColId: string) => void;
  handleClearRow: (rowIndex: number) => void;
  handleRemoveItemFromRow: (rowIndex: number, colId: string) => void;
  
  // Custom Drag & Drop State
  draggedItem: DraggedItemInfo | null;
  setDraggedItem: React.Dispatch<React.SetStateAction<DraggedItemInfo | null>>;
  dropTargetRow: number | null;
  setDropTargetRow: React.Dispatch<React.SetStateAction<number | null>>;

  // Modal & templates
  allTemplates: GameTemplate[];
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TextureMapperContext = createContext<TextureMapperContextType | null>(null);

export const useTextureMapper = (): TextureMapperContextType => {
  const context = useContext(TextureMapperContext);
  if (!context) {
    throw new Error('useTextureMapper must be used within a TextureMapperProvider');
  }
  return context;
};
