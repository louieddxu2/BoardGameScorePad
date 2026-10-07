import React, { useMemo } from 'react';
import type { buildHistoryStats } from '../../../utils/historyStats';
import { getHistoryPhotoGridBaseSize } from '../../../utils/historyPhotoGrid';
import { type EditableGridTile, PHOTO_RECAP_TILE_ASPECT, PHOTO_RECAP_CAPTION_HEIGHT_RATIO, PHOTO_RECAP_ROW_GAP_HEIGHT_RATIO, getTileFrameAspect, formatGridDate } from '../historyPhotoGridModel';

interface PhotoGridCanvasProps {
  tiles: EditableGridTile[];
  stats: ReturnType<typeof buildHistoryStats>;
  contextLabel: string;
  labels: {
    plays: string;
    games: string;
    players: string;
  };
  onSelect?: (index: number) => void;
  isSingleGame?: boolean;
}
export const PhotoGridCanvas = React.forwardRef<HTMLDivElement, PhotoGridCanvasProps>(({ tiles, stats, contextLabel, labels, onSelect, isSingleGame }, ref) => {
  const activeTiles = useMemo(() => tiles.filter(tile => tile && tile.url), [tiles]);
  const N = activeTiles.length;
  const shouldHideTileGameName = isSingleGame || new Set(activeTiles.map(tile => tile.gameKey)).size === 1;

  const layout = useMemo(() => {
    if (N === 0) return { cols: 1, rows: 1, aspect: PHOTO_RECAP_TILE_ASPECT };
    if (N === 1) return { cols: 1, rows: 1, aspect: PHOTO_RECAP_TILE_ASPECT };
    if (N === 2) return { cols: 1, rows: 2, aspect: PHOTO_RECAP_TILE_ASPECT / 2 };

    const cols = 2;
    const rows = N % 2 !== 0 ? 2 + (N - 1) / 2 : N / 2;
    const photoOnlyAspect = (2 * PHOTO_RECAP_TILE_ASPECT) / rows;
    const captionHeight = shouldHideTileGameName ? 0 : rows * PHOTO_RECAP_CAPTION_HEIGHT_RATIO;
    const rowGapHeight = Math.max(0, rows - 1) * PHOTO_RECAP_ROW_GAP_HEIGHT_RATIO;
    const aspect = 1 / (1 / photoOnlyAspect + captionHeight + rowGapHeight);
    return { cols, rows, aspect };
  }, [N, shouldHideTileGameName]);

  if (N === 0) return null;

  return (
    <div
      ref={ref}
      style={{
        containerType: 'inline-size',
        aspectRatio: `${layout.aspect}`
      }}
      className="w-full bg-app-bg p-[1.2cqw] flex flex-col gap-[1.2cqw] rounded-[2cqw] border border-surface-border shadow-2xl overflow-hidden"
    >
      <div className="flex-none rounded-[1.5cqw] bg-app-bg-deep border border-surface-border px-[2cqw] py-[2cqw] flex items-center justify-between gap-[1.5cqw]">
        <div className="min-w-0 flex-1">
          <div className="text-[4.2cqw] leading-tight font-black text-txt-title truncate">{contextLabel}</div>
        </div>
        <div className="flex items-center gap-[1.5cqw] text-right shrink-0">
          <StatPill value={stats.gameCount} label={labels.games} />
          <StatPill value={stats.playCount} label={labels.plays} />
          <StatPill value={stats.playerCount} label={labels.players} />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 grid gap-x-[0.8cqw] gap-y-[2cqw]"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`
        }}
      >
        {activeTiles.map((tile, index) => {
          const isLarge = N >= 3 && N % 2 !== 0 && index === 0;

          return (
            <button
              key={`${tile.id}-${index}`}
              onClick={() => onSelect?.(tiles.indexOf(tile))}
              disabled={!onSelect}
              className={`bg-app-bg-deep border border-surface-border rounded-[1cqw] overflow-hidden select-none disabled:cursor-default active:scale-[0.99] transition-transform relative min-h-0 ${
                isLarge ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'
              }`}
            >
              <PhotoTile tile={tile} hideGameName={shouldHideTileGameName} />
            </button>
          );
        })}
      </div>
    </div>
  );
});

PhotoGridCanvas.displayName = 'PhotoGridCanvas';

const StatPill: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="min-w-[15cqw]">
    <div className="text-[5.5cqw] leading-none font-black font-mono text-txt-title">{value}</div>
    <div className="mt-[0.5cqw] text-[2.4cqw] leading-none font-bold text-txt-muted uppercase tracking-normal">{label}</div>
  </div>
);

export const PhotoImage: React.FC<{ tile: EditableGridTile }> = ({ tile }) => {
  const base = getHistoryPhotoGridBaseSize(tile.imageSize, getTileFrameAspect(tile));
  return (
    <img
      src={tile.url}
      alt={tile.gameName}
      draggable={false}
      className="absolute select-none max-w-none max-h-none"
      style={{
        left: `${50 + tile.crop.offsetX * 100}%`,
        top: `${50 + tile.crop.offsetY * 100}%`,
        width: `${base.width * 100}%`,
        height: `${base.height * 100}%`,
        transform: `translate(-50%, -50%) scale(${tile.crop.zoom})`,
        transformOrigin: 'center center'
      }}
    />
  );
};

const PhotoTile: React.FC<{ tile: EditableGridTile; hideGameName?: boolean }> = ({ tile, hideGameName }) => {
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-app-bg-deep">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-app-bg-deep">
        <PhotoImage tile={tile} />
        <div className="pointer-events-none absolute right-[1.5cqw] bottom-[1.5cqw] px-[1.2cqw] py-[0.8cqw] rounded-[0.8cqw] bg-black/55 text-white">
          <span className="text-[2.2cqw] leading-none text-white/75 font-mono">{formatGridDate(tile.endTime)}</span>
        </div>
      </div>
      {!hideGameName && (
        <div className="flex-none h-[8cqw] min-h-0 px-[2cqw] bg-app-bg-deep flex items-center">
          <span className="min-w-0 flex-1 truncate text-left text-[3.2cqw] leading-none font-bold text-txt-primary">
            {tile.gameName}
          </span>
        </div>
      )}
    </div>
  );
};
