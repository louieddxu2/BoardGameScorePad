
import { GameTemplate, ScoreColumn, Rect } from '../../../types';
import { GridBounds } from '../TextureMapperContext';
import { generateId } from '../../../utils/idGenerator';

// Helper to round to 3 decimal places
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Helper to round to 6 decimal places (for 0-1 percentages)
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
  aspectRatio: number, // [New]
  slotNameTemplate: string, // [i18n]
  itemNameTemplate: string // [i18n]
): GameTemplate => {

  // [Refactor] Now returns Normalized Coordinates (0.0 to 1.0) instead of Pixels
  const getRect = (rIdx: number, cIdx: number): Rect | undefined => {
    if (rIdx < 0 || cIdx < 0 || rIdx >= sortedHLines.length - 1 || cIdx >= sortedVLines.length - 1) return undefined;
    const y1 = sortedHLines[rIdx];
    const y2 = sortedHLines[rIdx + 1];
    const x1 = sortedVLines[cIdx];
    const x2 = sortedVLines[cIdx + 1];

    // Inputs (lines) are 0-100 percentages.
    // Convert to 0-1 normalized values directly.
    const normX = x1 / 100;
    const normY = y1 / 100;
    const normW = (x2 - x1) / 100;
    const normH = (y2 - y1) / 100;

    // Apply high precision rounding
    return {
      x: round6(normX),
      y: round6(normY),
      width: round6(normW),
      height: round6(normH),
    };
  };

  // Helper to generate Mask Rects (Normalized 0-1)
  const getMaskRect = (type: 'top' | 'bottom' | 'left' | 'right'): Rect | undefined => {
    // gridBounds are 0-100

    if (type === 'top' && gridBounds.top > 0) {
      return {
        x: 0,
        y: 0,
        width: 1, // Full width 
        height: round6(gridBounds.top / 100)
      };
    }
    if (type === 'bottom' && gridBounds.bottom < 100) {
      const topY = round6(gridBounds.bottom / 100);
      return {
        x: 0,
        y: topY,
        width: 1,
        height: round6(1 - topY)
      };
    }
    if (type === 'left' && gridBounds.left > 0) {
      const topY = round6(gridBounds.top / 100);
      const bottomY = round6(gridBounds.bottom / 100);
      return {
        x: 0,
        y: topY,
        width: round6(gridBounds.left / 100),
        height: round6(bottomY - topY)
      };
    }
    if (type === 'right' && gridBounds.right < 100) {
      const topY = round6(gridBounds.top / 100);
      const bottomY = round6(gridBounds.bottom / 100);
      const leftX = round6(gridBounds.right / 100);
      return {
        x: leftX,
        y: topY,
        width: round6(1 - leftX),
        height: round6(bottomY - topY)
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
          // [Fix] Keep original ID when mapping existing template to support "Edit Grid" flow
          newCol.id = sourceCol.id;
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
          name: slotNameTemplate.replace('{n}', String(i + 1)),
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
        name: itemNameTemplate.replace('{n}', String(i + 1)),
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
    // [Fix] Always generate a new ID to prevent linking to imported template's images.
    // If this is an update to an existing template, the parent component will override this ID.
    id: generateId(),
    name: initialName,
    bggId: importedTemplate?.bggId || '', // [New] Initialize BGG ID
    columns: finalColumns,
    createdAt: Date.now(),
    hasImage: true,
    globalVisuals: {
      aspectRatio: round6(aspectRatio),
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