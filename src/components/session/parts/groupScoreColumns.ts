import type { ScoreColumn } from '../../../types';

export type ScoreGridColumn = ScoreColumn & {
  resolvedDisplayMode: NonNullable<ScoreColumn['displayMode']>;
  overlayColumns: ScoreColumn[];
};

const getDisplayMode = (column: ScoreColumn) => column.displayMode || 'row';

export function findPreviousScoreRow(columns: readonly ScoreColumn[], columnId: string): ScoreColumn | undefined {
  const columnIndex = columns.findIndex(column => column.id === columnId);
  for (let index = columnIndex - 1; index >= 0; index--) {
    const column = columns[index];
    if (getDisplayMode(column) === 'row') return column;
  }
}

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
    const precedingRow = findPreviousScoreRow(columns, overlay.id);
    if (!precedingRow) continue;
    const host = visibleColumns.find(row => row.id === precedingRow.id);
    host?.overlayColumns.push(overlay);
  }

  return visibleColumns;
}
