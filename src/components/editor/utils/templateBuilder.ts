
import { GameTemplate, ScoreColumn, Rect } from '../../../types';
import { GridBounds } from '../TextureMapperContext';

// Helper to round to 3 decimal places
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Helper to round to 6 decimal places
const round6 = (n: number) => Math.round(n * 1000000) / 1000000;

export const buildTemplateFromTextureMap = (
  initialName: string,
  isMappingMode: boolean,
  importedTemplate: GameTemplate | null,
  rowCount: number,
  rowMapping: string[][],
  headerSepIdx: number,
  totalSepIdx: number,
  dataColIdx: number,
  sortedHLines: number[],
  sortedVLines: number[],
  naturalWidth: number,
  naturalHeight: number,
  gridBounds: GridBounds, // New parameter
  aspectRatio: number // [New]
): GameTemplate => {
  const getRect = (rIdx: number, cIdx: number): Rect | undefined => {
    if (rIdx < 0 || cIdx < 0 || rIdx >= sortedHLines.length - 1 || cIdx >= sortedVLines.length - 1) return undefined;
    const y1 = sortedHLines[rIdx];
    const y2 = sortedHLines[rIdx + 1];
    const x1 = sortedVLines[cIdx];
    const x2 = sortedVLines[cIdx + 1];
    
    // Calculate raw pixel values
    const rawX = (x1 / 100) * naturalWidth;
    const rawY = (y1 / 100) * naturalHeight;
    const rawW = ((x2 - x1) / 100) * naturalWidth;
    const rawH = ((y2 - y1) / 100) * naturalHeight;

    // Apply rounding
    return {
      x: round3(rawX),
      y: round3(rawY),
      width: round3(rawW),
      height: round3(rawH),
    };
  };

  // Helper to generate Mask Rects
  const getMaskRect = (type: 'top' | 'bottom' | 'left' | 'right'): Rect | undefined => {
      if (type === 'top' && gridBounds.top > 0) {
          return { x: 0, y: 0, width: naturalWidth, height: round3((gridBounds.top / 100) * naturalHeight) };
      }
      if (type === 'bottom' && gridBounds.bottom < 100) {
          const topY = round3((gridBounds.bottom / 100) * naturalHeight);
          return { x: 0, y: topY, width: naturalWidth, height: naturalHeight - topY };
      }
      if (type === 'left' && gridBounds.left > 0) {
          // Left mask is strictly the area to the left of the grid, 
          // bounded vertically by the grid's top/bottom to avoid overlap with top/bottom masks.
          const topY = round3((gridBounds.top / 100) * naturalHeight);
          const bottomY = round3((gridBounds.bottom / 100) * naturalHeight);
          return { 
              x: 0, 
              y: topY, 
              width: round3((gridBounds.left / 100) * naturalWidth), 
              height: bottomY - topY 
          };
      }
      if (type === 'right' && gridBounds.right < 100) {
          // Right mask
          const topY = round3((gridBounds.top / 100) * naturalHeight);
          const bottomY = round3((gridBounds.bottom / 100) * naturalHeight);
          const leftX = round3((gridBounds.right / 100) * naturalWidth);
          return {
              x: leftX,
              y: topY,
              width: naturalWidth - leftX,
              height: bottomY - topY
          };
      }
      return undefined;
  };

  const itemRowsStartIdx = headerSepIdx;
  const finalColumns: ScoreColumn[] = [];

  for (let i = 0; i < rowCount; i++) {
    const targetRowIdx = itemRowsStartIdx + i;
    const colIdsInRow = rowMapping[i] || [];

    if (colIdsInRow.length > 0) {
      // Create a column for each ID in the row
      colIdsInRow.forEach(sourceColId => {
        const sourceCol = importedTemplate!.columns.find(c => c.id === sourceColId);
        if (sourceCol) {
          const newCol: ScoreColumn = JSON.parse(JSON.stringify(sourceCol));
          newCol.id = crypto.randomUUID();
          // All columns from the same row share the same visual rects
          newCol.visuals = { headerRect: getRect(targetRowIdx, 0), cellRect: getRect(targetRowIdx, dataColIdx) };
          finalColumns.push(newCol);
        }
      });
    } else {
      // If the row is empty in mapping mode, create a hidden placeholder column.
      if (isMappingMode) {
        const newCol: ScoreColumn = {
          id: crypto.randomUUID(),
          name: `(空格 ${i + 1})`,
          isScoring: false,
          formula: 'a1',
          inputType: 'keypad',
          rounding: 'none',
          visuals: { headerRect: getRect(targetRowIdx, 0), cellRect: getRect(targetRowIdx, dataColIdx) },
          displayMode: 'hidden',
        };
        finalColumns.push(newCol);
      }
    }
  }

  // If not in mapping mode (i.e., manual creation), generate standard columns.
  if (!isMappingMode) {
      for (let i = 0; i < rowCount; i++) {
        const targetRowIdx = itemRowsStartIdx + i;
        const newCol: ScoreColumn = {
            id: crypto.randomUUID(),
            name: `項目 ${i + 1}`,
            isScoring: true,
            formula: 'a1',
            inputType: 'keypad',
            rounding: 'none',
            // DO NOT assign color for textured templates, so they appear transparent/default
            color: undefined, 
            visuals: { headerRect: getRect(targetRowIdx, 0), cellRect: getRect(targetRowIdx, dataColIdx) },
        };
        finalColumns.push(newCol);
      }
  }
  
  const newTemplate: GameTemplate = {
    id: crypto.randomUUID(),
    name: initialName,
    columns: finalColumns,
    createdAt: Date.now(),
    hasImage: true,
    globalVisuals: {
      aspectRatio: round6(aspectRatio), // [Modified] Apply rounding
      playerLabelRect: getRect(Math.max(0, headerSepIdx - 1), 0),
      playerHeaderRect: getRect(Math.max(0, headerSepIdx - 1), dataColIdx),
      totalRowRect: getRect(totalSepIdx, dataColIdx),
      totalLabelRect: getRect(totalSepIdx, 0),
      // New Masks
      topMaskRect: getMaskRect('top'),
      bottomMaskRect: getMaskRect('bottom'),
      leftMaskRect: getMaskRect('left'),
      rightMaskRect: getMaskRect('right'),
    },
  };
  return newTemplate;
};
