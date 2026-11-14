import type { ScoreColumn } from '../../../types';

export type ScoreGridColumn = ScoreColumn & {
  resolvedDisplayMode: NonNullable<ScoreColumn['displayMode']>;
  overlayColumns: ScoreColumn[];
};

const getDisplayMode = (column: ScoreColumn) => column.displayMode || 'row';

export function groupScoreColumns(
  columns: readonly ScoreColumn[],
  isEditMode = false,
): ScoreGridColumn[] {
  if (isEditMode) {
    return columns.map(column => ({
      ...column,
      resolvedDisplayMode: getDisplayMode(column),
      overlayColumns: [],
    }));
  }

  const visibleColumns: ScoreGridColumn[] = [];
  const overlays: ScoreColumn[] = [];
  for (const column of columns) {
    const displayMode = getDisplayMode(column);
    if (displayMode === 'row') {
      visibleColumns.push({ ...column, resolvedDisplayMode: 'row', overlayColumns: [] });
    } else if (displayMode === 'overlay') {
      overlays.push(column);
    }
  }

  for (const overlay of overlays) {
    const overlayIndex = columns.findIndex(column => column.id === overlay.id);
    for (let index = overlayIndex - 1; index >= 0; index--) {
      const column = columns[index];
      if (getDisplayMode(column) === 'row') {
        const host = visibleColumns.find(row => row.id === column.id);
        host?.overlayColumns.push(overlay);
        break;
      }
    }
  }

  return visibleColumns;
}
