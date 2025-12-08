import React, { useRef } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../../types';
import { Trophy, GripVertical, Settings } from 'lucide-react';
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
}) => {
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate });
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="absolute inset-0 z-0 overflow-auto bg-slate-900 custom-scrollbar pb-32" ref={tableContainerRef}>
      <div className="min-w-fit relative">
        {/* Player Headers */}
        <div className="flex sticky top-0 z-20 bg-slate-800">
          <div className="sticky left-0 w-[70px] bg-slate-800 border-r border-b border-slate-700 p-2 flex items-center justify-center z-30 shadow-sm">
            <Trophy size={20} className="text-emerald-500" />
          </div>
          {session.players.map(p => (
            <div
              key={p.id}
              onClick={(e) => onPlayerHeaderClick(p.id, e)}
              className={`min-w-[54px] flex-1 border-r border-b border-slate-700 p-2 flex flex-col items-center justify-center relative cursor-pointer transition-all ${editingPlayerId === p.id ? 'z-20 ring-2 ring-inset ring-white/50' : ''}`}
              style={{ backgroundColor: `${p.color}20`, borderBottomColor: p.color, borderBottomWidth: '2px' }}
            >
              <span className="text-xs font-bold truncate max-w-full" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {template.columns.map(col => {
          const isDragging = dnd.draggingId === col.id;
          const isDropTarget = dnd.dropTargetId === col.id;
          return (
            <div
              key={col.id}
              id={`row-${col.id}`}
              className={`flex relative z-10 transition-all ${isDragging ? 'opacity-40' : 'opacity-100'} ${isDropTarget ? 'border-t-2 border-emerald-500' : ''}`}
            >
              <div
                onClick={(e) => onColumnHeaderClick(e, col)}
                draggable={true}
                onDragStart={(e) => dnd.handleDragStart(e, col.id)}
                onDragOver={(e) => dnd.handleDragOver(e, col.id)}
                onDrop={(e) => dnd.handleDrop(e, col.id)}
                onTouchStart={(e) => dnd.handleTouchStart(e, col.id)}
                onTouchMove={dnd.handleTouchMove}
                onTouchEnd={dnd.handleTouchEnd}
                data-row-id={col.id}
                className={`sticky left-0 w-[70px] bg-slate-800 border-r-2 border-b border-slate-700 p-2 flex flex-col justify-center cursor-pointer hover:bg-slate-700 transition-colors z-20 group select-none ${isDragging ? 'cursor-grabbing bg-slate-700' : 'cursor-grab'}`}
                style={{ borderRightColor: col.color || 'var(--border-slate-700)' }}
              >
                <span className="text-xs font-bold text-slate-300 w-full text-center break-words whitespace-normal leading-tight" style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>
                  {col.name}
                </span>
                {col.isScoring && (
                    <div className="text-[10px] text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                        {(() => {
                            if (col.calculationType === 'product' && col.subUnits) return <div className="flex items-center justify-center gap-0.5 whitespace-nowrap w-full"><span className="truncate max-w-[30px]">{col.subUnits[0]}</span><span className="text-slate-600 text-[9px]">×</span><span className="truncate max-w-[30px]">{col.subUnits[1]}</span></div>;
                            if (col.type === 'select') return <div className="flex items-center gap-1"><Settings size={10} />{col.unit && <span className="scale-90">{col.unit}</span>}</div>;
                            if (col.weight !== 1) return <div className="flex items-center justify-center gap-0.5 whitespace-nowrap w-full"><span className="text-emerald-500 font-bold font-mono">{col.weight}</span><span className="text-slate-600 text-[9px]">×</span><span className="truncate max-w-[40px]">{col.unit}</span></div>;
                            if (col.unit) return <span className="scale-90 truncate max-w-full">{col.unit}</span>;
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
        {/* Spacer to allow scrolling panel content into view */}
        <div className={`w-full pointer-events-none ${editingCell || editingPlayerId ? 'h-[60vh]' : 'h-0'}`} />
      </div>
    </div>
  );
};

export default ScoreGrid;
