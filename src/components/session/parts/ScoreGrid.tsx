import React from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../../types';
import { GripVertical, Settings } from 'lucide-react';
import ScoreCell from '../ScoreCell';
import { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

interface ScoreGridProps {
  session: GameSession;
  template: GameTemplate;
  editingCell: { playerId: string, colId: string } | null;
  editingPlayerId: string | null;
  onCellClick: (playerId: string, colId: string, e: React.MouseEvent) => void;
  onPlayerHeaderClick: (playerId: string, e: React.MouseEvent) => void;
  onColumnHeaderClick: (e: React.MouseEvent, col: ScoreColumn) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ScoreGrid: React.FC<ScoreGridProps> = ({
  session,
  template,
  editingCell,
  editingPlayerId,
  onCellClick,
  onPlayerHeaderClick,
  onColumnHeaderClick,
  onUpdateTemplate,
  scrollContainerRef,
}) => {
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate, scrollRef: scrollContainerRef });

  // Determine the index of the item currently being dragged
  const dragIndex = template.columns.findIndex(c => c.id === dnd.draggingId);
  const lastColId = template.columns.length > 0 ? template.columns[template.columns.length - 1].id : null;
  
  return (
    <div className="absolute inset-0 z-0 overflow-auto bg-slate-900 no-scrollbar pb-32" ref={scrollContainerRef}>
      <div id="live-grid-container" className="min-w-fit relative">
        {/* Player Headers */}
        <div id="live-player-header-row" className="flex sticky top-0 z-20 bg-slate-800">
          <div className="sticky left-0 w-[70px] bg-slate-800 border-r border-b border-slate-700 p-2 flex items-center justify-center z-30 shadow-sm">
            <span className="font-bold text-sm text-slate-400">玩家</span>
          </div>
          {session.players.map(p => (
            <div
              key={p.id}
              onClick={(e) => onPlayerHeaderClick(p.id, e)}
              className={`min-w-[54px] flex-1 border-r border-b border-slate-700 p-2 flex flex-col items-center justify-center relative cursor-pointer transition-all ${editingPlayerId === p.id ? 'z-20 ring-2 ring-inset ring-white/50' : ''}`}
              style={{ backgroundColor: `${p.color}20`, borderBottomColor: p.color, borderBottomWidth: '2px' }}
            >
              <span className="text-sm font-bold truncate max-w-full" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {template.columns.map((col, index) => {
          const isDragging = dnd.draggingId === col.id;
          const isDropTarget = dnd.dropTargetId === col.id;
          
          let indicator = null;
          
          // Visual Indicators Logic
          // Only show if we are in a drag session (draggingId exists) and this row is the current target
          if (dnd.draggingId && isDropTarget) {
              if (isDragging) {
                  // Case: Hovering over self (In Place) -> Show Dashed Border
                  indicator = (
                      <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-slate-400/50 bg-slate-500/5" />
                  );
              } else if (dragIndex < index) {
                  // Case: Dragging Down -> Insert After (Bottom Line)
                  // Use translate-y-1/2 to center the 4px line exactly on the bottom edge
                  indicator = (
                      <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] z-50 pointer-events-none rounded-full translate-y-1/2" />
                  );
              } else {
                  // Case: Dragging Up -> Insert Before (Top Line)
                  // Use -translate-y-1/2 to center the 4px line exactly on the top edge
                  indicator = (
                      <div className="absolute top-0 left-0 right-0 h-[4px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] z-50 pointer-events-none rounded-full -translate-y-1/2" />
                  );
              }
          }

          return (
            <div
              key={col.id}
              id={`row-${col.id}`}
              data-row-id={col.id}
              // IMPORTANT: Move drop handlers to the Row Container.
              // This ensures that dragging anywhere on the row (even score cells) counts as a valid target.
              onDragOver={(e) => dnd.handleDragOver(e, col.id)}
              onDrop={(e) => dnd.handleDrop(e, col.id)}
              className={`flex relative z-10 transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            >
              {indicator}

              <div
                // The Header is the "Handle" (draggable source)
                onClick={(e) => onColumnHeaderClick(e, col)}
                draggable={true}
                onDragStart={(e) => dnd.handleDragStart(e, col.id)}
                onDragEnd={dnd.handleDragEnd} // IMPORTANT: Reset state when drag ends (valid or invalid)
                onTouchStart={(e) => dnd.handleTouchStart(e, col.id)}
                onTouchMove={dnd.handleTouchMove}
                onTouchEnd={dnd.handleTouchEnd}
                className={`sticky left-0 w-[70px] bg-slate-800 border-r-2 border-b border-slate-700 p-2 flex flex-col justify-center cursor-pointer hover:bg-slate-700 transition-colors z-20 group select-none ${isDragging ? 'cursor-grabbing bg-slate-700' : 'cursor-grab'}`}
                style={{ borderRightColor: col.color || 'var(--border-slate-700)' }}
              >
                <span className="text-sm font-bold text-slate-300 w-full text-center break-words whitespace-normal leading-tight" style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>
                  {col.name}
                </span>
                {col.isScoring && (
                    <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                        {(() => {
                            if (col.calculationType === 'product' && col.subUnits) return <div className="flex items-center justify-center gap-0.5 whitespace-nowrap w-full"><span className="truncate max-w-[30px]">{col.subUnits[0]}</span><span className="text-slate-600 text-[11px]">×</span><span className="truncate max-w-[30px]">{col.subUnits[1]}</span></div>;
                            if (col.type === 'select') return <div className="flex items-center gap-1"><Settings size={10} />{col.unit && <span className="text-xs">{col.unit}</span>}</div>;
                            if (col.weight !== 1) return <div className="flex items-center justify-center gap-0.5 whitespace-nowrap w-full"><span className="text-emerald-500 font-bold font-mono">{col.weight}</span><span className="text-slate-600 text-[11px]">×</span><span className="truncate max-w-[40px]">{col.unit}</span></div>;
                            if (col.unit) return <span className="text-xs truncate max-w-full">{col.unit}</span>;
                            return null;
                        })()}
                    </div>
                )}
                <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity"><GripVertical size={12} /></div>
              </div>
              {session.players.map(p => (
                <ScoreCell
                  key={p.id}
                  player={p}
                  column={col}
                  isActive={editingCell?.playerId === p.id && editingCell?.colId === col.id}
                  onClick={(e) => onCellClick(p.id, col.id, e)}
                />
              ))}
            </div>
          );
        })}
        
        {/* Spacer / Bottom Drop Zone */}
        {/* Allows users to drag to the empty space at the bottom and have it count as the last item */}
        {/* Removed transition-all to fix scroll calculation issue when panel opens */}
        <div 
            data-row-id={lastColId} 
            onDragOver={(e) => {
                if (lastColId) dnd.handleDragOver(e, lastColId);
            }}
            onDrop={(e) => {
                if (lastColId) dnd.handleDrop(e, lastColId);
            }}
            className={`w-full ${editingCell || editingPlayerId ? 'h-[40vh]' : 'h-24'}`} 
        />
      </div>
    </div>
  );
};

export default ScoreGrid;