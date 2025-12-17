import React from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../../types';
import { GripVertical, Settings } from 'lucide-react';
import ScoreCell from '../ScoreCell';
import { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { usePlayerWidthSync } from '../../../hooks/usePlayerWidthSync';

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
  contentRef: React.RefObject<HTMLDivElement>;
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
  contentRef,
}) => {
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate, scrollRef: scrollContainerRef });
  
  // 啟用寬度同步 Hook，並傳入欄位資訊
  usePlayerWidthSync(session.players, template.columns);

  const dragIndex = template.columns.findIndex(c => c.id === dnd.draggingId);
  const lastColId = template.columns.length > 0 ? template.columns[template.columns.length - 1].id : null;
  
  return (
    <div className="absolute inset-0 z-0 overflow-auto bg-slate-900 no-scrollbar pb-32" ref={scrollContainerRef}>
      <div 
        id="live-grid-container" 
        // 關鍵修改：
        // min-w-full: 確保內容少時，容器至少跟螢幕一樣寬 (背景色才會滿)
        // w-fit: 確保內容多時 (溢出)，容器會跟著內容變寬，而不是被截斷
        className="min-w-full w-fit relative"
        ref={contentRef}
      >
        {/* Player Headers */}
        <div id="live-player-header-row" className="flex sticky top-0 z-20 bg-slate-800">
          <div className="sticky left-0 w-[70px] bg-slate-800 border-r border-b border-slate-700 p-2 flex items-center justify-center z-30 shadow-sm shrink-0">
            <span className="font-bold text-sm text-slate-400">玩家</span>
          </div>
          {session.players.map(p => (
            <div
              key={p.id}
              id={`header-${p.id}`} // 用於 JS 抓取
              data-player-header-id={p.id} // 用於 ResizeObserver 識別
              onClick={(e) => onPlayerHeaderClick(p.id, e)}
              // 關鍵修改：
              // 改回 flex-auto，讓表頭在空間足夠時自動延展
              // 改用 rem (3.375rem = 54px) 確保隨縮放係數變化
              className={`flex-auto w-auto min-w-[3.375rem] border-r border-b border-slate-700 p-2 flex flex-col items-center justify-center relative cursor-pointer transition-all ${editingPlayerId === p.id ? 'z-20 ring-2 ring-inset ring-white/50' : ''}`}
              style={{ backgroundColor: `${p.color}20`, borderBottomColor: p.color, borderBottomWidth: '2px' }}
            >
              <span className="text-sm font-bold whitespace-nowrap" style={{ color: p.color, ...(isColorDark(p.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }}>
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
          
          if (dnd.draggingId && isDropTarget) {
              if (isDragging) {
                  indicator = (
                      <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-slate-400/50 bg-slate-500/5" />
                  );
              } else if (dragIndex < index) {
                  indicator = (
                      <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] z-50 pointer-events-none rounded-full translate-y-1/2" />
                  );
              } else {
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
              onDragOver={(e) => dnd.handleDragOver(e, col.id)}
              onDrop={(e) => dnd.handleDrop(e, col.id)}
              className={`flex relative z-10 transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            >
              {indicator}

              <div
                onClick={(e) => onColumnHeaderClick(e, col)}
                draggable={true}
                onDragStart={(e) => dnd.handleDragStart(e, col.id)}
                onDragEnd={dnd.handleDragEnd} 
                onTouchStart={(e) => dnd.handleTouchStart(e, col.id)}
                onTouchMove={dnd.handleTouchMove}
                onTouchEnd={dnd.handleTouchEnd}
                className={`sticky left-0 w-[70px] bg-slate-800 border-r-2 border-b border-slate-700 p-2 flex flex-col justify-center cursor-pointer hover:bg-slate-700 transition-colors z-20 group select-none shrink-0 ${isDragging ? 'cursor-grabbing bg-slate-700' : 'cursor-grab'}`}
                style={{ borderRightColor: col.color || 'var(--border-slate-700)' }}
              >
                <span className="text-sm font-bold text-slate-300 w-full text-center break-words whitespace-pre-wrap leading-tight" style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>
                  {col.name}
                </span>
                {col.isScoring && (
                    <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                        {(() => {
                            // --- Fix: Use `formula` and `options` for logic, not `type` or `calculationType`
                            if (col.formula === 'a1×a2' && col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span>{col.subUnits[0]}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span>{col.subUnits[1]}</span></div>;
                            if (col.inputType === 'clicker' && !col.formula.includes('+next')) return <div className="flex items-center justify-center gap-1 flex-wrap w-full"><Settings size={10} />{col.unit && <span className="text-xs break-words text-center">{col.unit}</span>}</div>;
                            if (col.formula === 'a1×c1') return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="text-emerald-500 font-bold font-mono">{col.constants?.c1 ?? 1}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="break-words text-center">{col.unit}</span></div>;
                            if (col.unit) return <span className="text-xs break-words w-full text-center">{col.unit}</span>;
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
        
        <div 
            data-row-id={lastColId} 
            onDragOver={(e) => { if (lastColId) dnd.handleDragOver(e, lastColId); }}
            onDrop={(e) => { if (lastColId) dnd.handleDrop(e, lastColId); }}
            className={`w-full ${editingCell || editingPlayerId ? 'h-[40vh]' : 'h-24'}`} 
        />
      </div>
    </div>
  );
};

export default ScoreGrid;