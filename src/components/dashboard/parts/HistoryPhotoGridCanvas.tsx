import React, { useMemo } from 'react';
import type { buildHistoryStats } from '../../../utils/historyStats';
import { getHistoryPhotoGridBaseSize } from '../../../utils/historyPhotoGrid';
import { type EditableGridTile, PHOTO_RECAP_TILE_ASPECT, PHOTO_RECAP_ROW_GAP_HEIGHT_RATIO, getTileFrameAspect, formatGridDate } from '../historyPhotoGridModel';
import { PHOTO_TITLE_FALLBACK } from '../../../utils/photoTitleContrast';
import type { HistoryPhotoRecapContext } from '../../../utils/historyPhotoRecapContext';

// Match the photo title's fine edge and local scrim, scaling with preview/export width.
// Fixed paint avoids extra pixel reads for each preview and export tile.
const PHOTO_LABEL_PAINT: React.CSSProperties = {
  color: PHOTO_TITLE_FALLBACK.color,
  textShadow: PHOTO_TITLE_FALLBACK.shadow.replace(/(-?[\d.]+)px/g,
    (_, value: string) => `${Number(value) * 0.075}cqw`),
};

interface PhotoGridCanvasProps {
  tiles: EditableGridTile[];
  stats: ReturnType<typeof buildHistoryStats>;
  context: HistoryPhotoRecapContext;
  scopeLabel?: string;
  filters?: string[];
  labels: {
    plays: string;
    games: string;
    players: string;
    recap: string;
    photoSelection: string;
    selectionUnit: string;
    selectionUnitSingle?: string;
  };
  onSelect?: (index: number) => void;
}
export const PhotoGridCanvas = React.forwardRef<HTMLDivElement, PhotoGridCanvasProps>(({ tiles, stats, context, scopeLabel, filters, labels, onSelect }, ref) => {
  const activeTiles = useMemo(() => tiles.filter(tile => tile && tile.url), [tiles]);
  const N = activeTiles.length;
  const shouldHideTileGameName = context.isSingleGame && !!context.gameName;
  const shouldHideTileDate = context.isSingleDay && !!context.dateLabel;
  const title = context.gameName || context.dateLabel || labels.recap;
  const subtitle = context.gameName ? context.dateLabel : context.dateLabel ? labels.recap : '';
  const details = [scopeLabel, ...(filters ?? [])].filter(Boolean).join(' · ');

  const layout = useMemo(() => {
    if (N === 0) return { cols: 1, rows: 1, aspect: PHOTO_RECAP_TILE_ASPECT };
    if (N === 1) return { cols: 1, rows: 1, aspect: PHOTO_RECAP_TILE_ASPECT };
    const cols = N === 2 ? 1 : 2;
    const rows = N === 2 ? 2 : N % 2 !== 0 ? 2 + (N - 1) / 2 : N / 2;
    const photoOnlyAspect = (cols * PHOTO_RECAP_TILE_ASPECT) / rows;
    const rowGapHeight = Math.max(0, rows - 1) * PHOTO_RECAP_ROW_GAP_HEIGHT_RATIO;
    const aspect = 1 / (1 / photoOnlyAspect + rowGapHeight);
    return { cols, rows, aspect };
  }, [N]);

  if (N === 0) return null;

  return (
    <div
      ref={ref}
      style={{
        containerType: 'inline-size'
      }}
      className="w-full bg-app-bg p-[1.2cqw] flex flex-col gap-[1.2cqw] rounded-[2cqw] border border-surface-border shadow-2xl overflow-hidden"
    >
      <div className="flex-none rounded-[1.5cqw] bg-app-bg-deep border border-surface-border px-[2cqw] py-[2cqw] flex items-center justify-between gap-[1.5cqw]">
        <div className="min-w-0 flex-1">
          <div className="text-[4.2cqw] leading-tight font-black text-txt-title break-words">{title}</div>
          {subtitle && <div className="mt-[0.6cqw] text-[2.8cqw] leading-snug font-medium text-txt-secondary break-words">{subtitle}</div>}
          {details && <div className="mt-[0.6cqw] text-[2.4cqw] leading-snug text-txt-secondary break-words">{details}</div>}
        </div>
        <div className="flex items-center gap-[1.5cqw] text-right shrink-0">
          {stats.gameCount > 1 && <StatPill value={stats.gameCount} label={labels.games} />}
          <StatPill value={stats.playCount} label={labels.plays} />
          <StatPill value={stats.playerCount} label={labels.players} />
        </div>
      </div>

      <div
        className="shrink-0 grid gap-[0.8cqw]"
        style={{
          aspectRatio: `${layout.aspect}`,
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`
        }}
      >
        {activeTiles.map((tile, index) => {
          const isLarge = N >= 3 && N % 2 !== 0 && index === 0;

          return (
            <button
              key={`${tile.id}-${index}`}
              type="button"
              aria-label={`${tile.gameName} · ${formatGridDate(tile.endTime, true)}`}
              onClick={() => onSelect?.(tiles.indexOf(tile))}
              disabled={!onSelect}
              className={`bg-app-bg-deep border border-surface-border rounded-[1cqw] overflow-hidden select-none disabled:cursor-default active:scale-[0.99] transition-transform relative min-h-0 ${
                isLarge ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'
              }`}
            >
              <PhotoTile tile={tile} hideGameName={shouldHideTileGameName} hideDate={shouldHideTileDate} includeYear={context.includePhotoYear} />
            </button>
          );
        })}
      </div>
      <div className="px-[0.8cqw] py-[0.4cqw] text-[2.4cqw] leading-snug text-txt-muted">
        {labels.photoSelection} · {N} {N === 1 ? labels.selectionUnitSingle ?? labels.selectionUnit : labels.selectionUnit}
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

const PhotoTile: React.FC<{ tile: EditableGridTile; hideGameName: boolean; hideDate: boolean; includeYear: boolean }> = ({ tile, hideGameName, hideDate, includeYear }) => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-app-bg-deep">
      <PhotoImage tile={tile} />
      {(!hideGameName || !hideDate) && <div className="pointer-events-none absolute inset-x-[1.5cqw] top-[1.5cqw] flex items-start gap-[1.5cqw]" style={PHOTO_LABEL_PAINT}>
        {!hideGameName && (
          <div className="relative min-w-0 text-left">
            <div aria-hidden="true" className="absolute -inset-[1cqw]" style={{ background: PHOTO_TITLE_FALLBACK.background }} />
            <span className="relative line-clamp-2 text-[3.2cqw] leading-tight font-black p-[0.15cqw] break-words">
              {tile.gameName}
            </span>
          </div>
        )}
        {!hideDate && <div className="relative ml-auto shrink-0">
          <div aria-hidden="true" className="absolute -inset-[1cqw]" style={{ background: PHOTO_TITLE_FALLBACK.background }} />
          <span className="relative text-[2.2cqw] leading-tight font-mono font-semibold whitespace-nowrap">{formatGridDate(tile.endTime, includeYear)}</span>
        </div>}
      </div>}
    </div>
  );
};
