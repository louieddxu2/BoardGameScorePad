
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../types';
import { ArrowLeft, Check, X, ArrowRight, ArrowDown, Trophy, RotateCcw, Crown, ChevronDown, Palette, History, Settings, Eraser, ListPlus, Share2, Image, Copy, GripVertical, Edit2 } from 'lucide-react';
import NumericKeypad from './NumericKeypad';
import ConfirmationModal from './shared/ConfirmationModal';
import ColumnConfigEditor from './shared/ColumnConfigEditor';
import ScoreCell from './session/ScoreCell';
import { COLORS } from '../src/constants';
import html2canvas from 'html2canvas';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onExit: () => void;
  onResetScores: () => void;
}

// Extracted Component to prevent re-mounting issues
const UnifiedInputLayout = ({ 
    leftContent,
    rightTools,
    onNext,
    advanceDirection
}: { 
    leftContent: React.ReactNode, 
    rightTools?: React.ReactNode,
    onNext: () => void,
    advanceDirection: 'horizontal' | 'vertical'
}) => (
    <div className="flex-1 min-h-0 p-2 grid grid-cols-4 gap-2 border-t border-slate-800 bg-slate-900">
        <div className="col-span-3 h-full overflow-hidden relative rounded-xl flex flex-col">
            {leftContent}
        </div>
        <div className="col-span-1 flex flex-col gap-2 h-full overflow-hidden">
            <div className="flex-1 bg-slate-800/20 rounded-xl overflow-hidden">
                {rightTools}
            </div>
            <button 
                onClick={onNext}
                className="flex-none h-16 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex flex-col items-center justify-center shadow-lg shadow-emerald-900/50 touch-manipulation transition-all active:scale-95"
            >
                {advanceDirection === 'horizontal' ? <ArrowRight size={24} /> : <ArrowDown size={24} />}
            </button>
        </div>
    </div>
);

const SessionView: React.FC<SessionViewProps> = ({ session, template, playerHistory, onUpdateSession, onUpdateTemplate, onUpdatePlayerHistory, onExit, onResetScores }) => {
  // State
  const [editingCell, setEditingCell] = useState<{playerId: string, colId: string} | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [tempName, setTempName] = useState(''); 
  const [isInputFocused, setIsInputFocused] = useState(false); 

  const [editingColumn, setEditingColumn] = useState<ScoreColumn | null>(null);
  const [advanceDirection, setAdvanceDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [overwriteMode, setOverwriteMode] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);
  
  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Drag and Drop State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number>(0);
  const isDraggingRef = useRef(false);
  
  // Share Menu State
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // Refs for sync scrolling
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const totalBarScrollRef = useRef<HTMLDivElement>(null);

  const handleTableScroll = () => {
      if (tableContainerRef.current && totalBarScrollRef.current) {
          totalBarScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
      }
  };

  // Effects
  useEffect(() => {
      if (editingCell) setOverwriteMode(true);
  }, [editingCell?.playerId, editingCell?.colId]);

  useEffect(() => {
    if (editingPlayerId) {
        const p = session.players.find(pl => pl.id === editingPlayerId);
        if (p) {
            setTempName(p.name);
            setIsInputFocused(false);
        }
    }
  }, [editingPlayerId]);

  // Scroll active cell to top
  useEffect(() => {
    if (editingCell) {
        // Use a double requestAnimationFrame to ensure the DOM layout (specifically the Spacer height)
        // has fully updated and the browser has recalculated the scrollHeight before we attempt to scroll.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const rowEl = document.getElementById(`row-${editingCell.colId}`);
                if (rowEl && tableContainerRef.current) {
                    const container = tableContainerRef.current;
                    // Dynamically calculate header height (sticky header)
                    const headerEl = container.querySelector('.sticky.top-0');
                    const headerHeight = headerEl ? headerEl.clientHeight : 48;

                    const rowTop = rowEl.offsetTop;
                    container.scrollTo({ top: rowTop - headerHeight, behavior: 'smooth' });
                }
            });
        });
    }
  }, [editingCell?.colId, editingCell?.playerId]);

  // Actions
  const updateScore = (playerId: string, colId: string, value: any) => {
    const players = session.players.map(p => {
      if (p.id !== playerId) return p;
      const newScores = { ...p.scores, [colId]: value };
      return { ...p, scores: newScores }; 
    });
    onUpdateSession({ ...session, players });
  };

  const updatePlayerColor = (playerId: string, color: string) => {
      const players = session.players.map(p => p.id === playerId ? { ...p, color } : p);
      onUpdateSession({ ...session, players });
  };

  const handlePlayerNameSubmit = (playerId: string, newName: string, moveNext: boolean = false) => {
      if (newName && newName.trim()) {
          onUpdatePlayerHistory(newName.trim());
          const players = session.players.map(p => p.id === playerId ? { ...p, name: newName } : p);
          onUpdateSession({ ...session, players });
      }
      
      if (moveNext) {
          const idx = session.players.findIndex(p => p.id === playerId);
          if (idx === -1) return;

          if (advanceDirection === 'horizontal') {
              if (idx < session.players.length - 1) {
                  setEditingPlayerId(session.players[idx + 1].id);
                  // We reset focus so the next player's setup screen is shown fully
                  setIsInputFocused(false); 
              } else {
                  if (template.columns.length > 0) {
                      setEditingPlayerId(null);
                      setEditingCell({ playerId: session.players[0].id, colId: template.columns[0].id });
                  } else {
                      setEditingPlayerId(null);
                  }
              }
          } else {
              if (template.columns.length > 0) {
                  setEditingPlayerId(null);
                  setEditingCell({ playerId: playerId, colId: template.columns[0].id });
              } else {
                  setEditingPlayerId(null);
              }
          }
      } else {
        setIsInputFocused(false);
      }
  };
  
  const handleTitleSubmit = () => {
      if (tempTitle.trim()) {
          onUpdateTemplate({ ...template, name: tempTitle.trim() });
      }
      setIsEditingTitle(false);
  };

  const moveToNextCell = () => {
    if (!editingCell) return;
    const playerIdx = session.players.findIndex(p => p.id === editingCell.playerId);
    const colIdx = template.columns.findIndex(c => c.id === editingCell.colId);
    
    if (playerIdx === -1 || colIdx === -1) return;

    if (advanceDirection === 'horizontal') {
        if (playerIdx < session.players.length - 1) {
            setEditingCell({ playerId: session.players[playerIdx + 1].id, colId: editingCell.colId });
        } else {
            if (colIdx < template.columns.length - 1) {
                const nextCol = template.columns[colIdx + 1];
                setEditingCell({ playerId: session.players[0].id, colId: nextCol.id });
            }
        }
    } else {
        if (colIdx < template.columns.length - 1) {
            const nextCol = template.columns[colIdx + 1];
            setEditingCell({ playerId: editingCell.playerId, colId: nextCol.id });
        } else {
            // Last attribute for this player
            if (playerIdx < session.players.length - 1) {
                 // Vertical mode: Go to next player's NAME instead of first score
                 setEditingCell(null);
                 setEditingPlayerId(session.players[playerIdx + 1].id);
            }
        }
    }
  };

  const handleCellClick = (playerId: string, colId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingPlayerId(null);
      if (editingCell?.playerId === playerId && editingCell?.colId === colId) {
          setEditingCell(null);
      } else {
          setEditingCell({ playerId, colId });
      }
  };

  const handleHeaderClick = (playerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingCell(null);
      if (editingPlayerId === playerId) {
          setEditingPlayerId(null);
      } else {
          setEditingPlayerId(playerId);
      }
  };

  const handleAddColumn = () => {
      const newCol: ScoreColumn = {
          id: crypto.randomUUID(),
          name: `項目 ${template.columns.length + 1}`,
          type: 'number',
          isScoring: true,
          weight: 1,
          options: [],
          mappingRules: [],
          unit: '',
          rounding: 'none',
          quickButtons: []
      };
      onUpdateTemplate({ ...template, columns: [...template.columns, newCol] });
  };

  const confirmDeleteColumn = () => {
      if (!columnToDelete) return;
      const newCols = template.columns.filter(c => c.id !== columnToDelete);
      onUpdateTemplate({ ...template, columns: newCols });
      setColumnToDelete(null);
      setEditingColumn(null);
  };
  
  // --- Drag and Drop Logic ---

  const moveColumn = (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const newCols = [...template.columns];
      const fromIdx = newCols.findIndex(c => c.id === fromId);
      const toIdx = newCols.findIndex(c => c.id === toId);
      
      if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = newCols.splice(fromIdx, 1);
          newCols.splice(toIdx, 0, moved);
          onUpdateTemplate({ ...template, columns: newCols });
      }
  };

  const handleDragStart = (e: React.DragEvent, colId: string) => {
      setDraggingId(colId);
      e.dataTransfer.effectAllowed = "move";
      // Transparent ghost image if needed, but default is usually fine
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
      e.preventDefault(); // Necessary to allow dropping
      if (draggingId !== colId) {
          setDropTargetId(colId);
      }
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
      e.preventDefault();
      if (draggingId && draggingId !== colId) {
          moveColumn(draggingId, colId);
      }
      setDraggingId(null);
      setDropTargetId(null);
  };

  // Touch Logic for Mobile Long Press Drag
  const handleTouchStart = (e: React.TouchEvent, colId: string) => {
      touchStartY.current = e.touches[0].clientY;
      isDraggingRef.current = false;
      
      longPressTimer.current = setTimeout(() => {
          setDraggingId(colId);
          isDraggingRef.current = true;
          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(50);
      }, 500); // 500ms long press to activate
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDraggingRef.current) {
          // If moved significantly before timer fires, cancel timer (it's a scroll)
          const moveY = e.touches[0].clientY;
          if (Math.abs(moveY - touchStartY.current) > 10) {
              if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }
          return;
      }
      
      // If dragging, prevent default scrolling
      if (e.cancelable) e.preventDefault();
      
      const touch = e.touches[0];
      const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
      const rowElement = targetElement?.closest('[data-row-id]');
      
      if (rowElement) {
          const targetId = rowElement.getAttribute('data-row-id');
          if (targetId && targetId !== draggingId) {
              setDropTargetId(targetId);
          }
      }
  };

  const handleTouchEnd = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      
      if (isDraggingRef.current && draggingId && dropTargetId) {
          moveColumn(draggingId, dropTargetId);
      }
      
      setDraggingId(null);
      setDropTargetId(null);
      isDraggingRef.current = false;
  };

  const handleHeaderCellClick = (e: React.MouseEvent, col: ScoreColumn) => {
      e.stopPropagation();
      // If we just finished a drag, don't open edit
      if (isDraggingRef.current) return;
      
      setEditingCell(null);
      setEditingPlayerId(null);
      setEditingColumn(col);
  };
  
  const handleScreenshot = async () => {
      setIsCopying(true);
      setShowShareMenu(false);
      
      // Delay to ensure menu is closed
      setTimeout(async () => {
          try {
              const element = document.getElementById('screenshot-target');
              if (element) {
                  const canvas = await html2canvas(element, {
                      backgroundColor: '#0f172a', // Slate 900
                      scale: 2, // High DPI
                  });
                  
                  canvas.toBlob((blob) => {
                      if (blob) {
                          const item = new ClipboardItem({ 'image/png': blob });
                          navigator.clipboard.write([item]).then(() => {
                              alert("計分表圖片已複製到剪貼簿！");
                          }).catch(err => {
                              console.error("Clipboard failed", err);
                              alert("複製失敗，請檢查瀏覽器權限。");
                          });
                      }
                  });
              }
          } catch (e) {
              console.error("Screenshot failed", e);
              alert("截圖失敗");
          } finally {
              setIsCopying(false);
          }
      }, 100);
  };

  // --- Render Helpers ---

  const renderPanelHeader = (title: string, player: Player, extraControls?: React.ReactNode) => (
      <div 
        className="border-b h-10 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar shrink-0 transition-colors"
        style={{ 
            backgroundColor: `${player.color}20`, // 12% opacity (approx)
            borderColor: `${player.color}40`, 
        }}
      >
          <span className="text-xs shrink-0 font-bold opacity-70" style={{ color: player.color }}>{title}</span>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <span className="text-sm font-bold truncate max-w-[120px]" style={{ color: player.color }}>{player.name}</span>
          
          <div className="flex-1"></div>
          
          {extraControls}

          <div className="flex bg-slate-900/80 rounded border border-slate-700 p-0.5 shrink-0 ml-2 backdrop-blur-sm">
              <button onClick={() => setAdvanceDirection('horizontal')} className={`p-1 rounded ${advanceDirection === 'horizontal' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><ArrowRight size={14}/></button>
              <button onClick={() => setAdvanceDirection('vertical')} className={`p-1 rounded ${advanceDirection === 'vertical' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><ArrowDown size={14}/></button>
          </div>
          
          <button 
            onClick={() => { setEditingCell(null); setEditingPlayerId(null); }}
            className="ml-2 hover:opacity-100 opacity-60"
            style={{ color: player.color }}
          >
              <ChevronDown size={20} />
          </button>
      </div>
  );

  const renderPlayerEditor = () => {
      const player = session.players.find(p => p.id === editingPlayerId);
      if (!player) return null;

      const inputSection = (
          <div className="flex-none h-16 mb-2">
              <input 
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onFocus={(e) => {
                      setIsInputFocused(true);
                      e.target.select();
                  }}
                  onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          e.currentTarget.blur();
                          handlePlayerNameSubmit(player.id, tempName, true);
                      }
                  }}
                  placeholder="輸入名稱"
                  className="w-full h-full bg-slate-800 border border-slate-600 rounded-xl px-4 text-xl font-bold text-white outline-none focus:border-emerald-500 placeholder-slate-500"
              />
          </div>
      );

      const historySection = !isInputFocused && (
          <div className="flex-1 flex gap-2 min-h-0 overflow-hidden animate-in fade-in duration-200">
                <div className="w-1/3 bg-slate-800/50 rounded-xl p-2 overflow-y-auto custom-scrollbar border border-slate-700/50">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 flex items-center justify-center gap-1"><Palette size={10}/> 顏色</div>
                    <div className="grid grid-cols-1 gap-2 justify-items-center">
                        {COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => updatePlayerColor(player.id, c)}
                                className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 ${player.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                style={{backgroundColor: c}}
                            />
                        ))}
                    </div>
                </div>
                
                <div className="w-2/3 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50 flex flex-col">
                    <div className="p-2 text-[10px] text-slate-500 font-bold uppercase bg-slate-800/80 text-center flex items-center justify-center gap-1"><History size={10}/> 歷史</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {playerHistory.slice(0, 20).map((name, i) => (
                            <button 
                                key={i}
                                onClick={() => handlePlayerNameSubmit(player.id, name, true)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-900/30 hover:text-emerald-400 transition-colors truncate active:scale-95 bg-slate-800"
                            >
                                {name}
                            </button>
                        ))}
                        {playerHistory.length === 0 && <div className="text-center text-xs text-slate-600 py-4">無紀錄</div>}
                    </div>
                </div>
          </div>
      );

      return (
        <div className="h-full flex flex-col bg-slate-900">
            {renderPanelHeader("編輯名稱", player)}
            <UnifiedInputLayout 
                leftContent={<>{inputSection}{historySection}</>}
                onNext={() => handlePlayerNameSubmit(player.id, tempName, true)} 
                advanceDirection={advanceDirection}
            />
        </div>
      );
  };

  const renderScoreEditor = () => {
      const col = template.columns.find(c => c.id === editingCell!.colId);
      const player = session.players.find(p => p.id === editingCell!.playerId);
      if (!col || !player) return null;

      const currentValue = player.scores[col.id];

      const extraControls = (
         <button 
             onClick={() => {
                 updateScore(player.id, col.id, undefined);
                 setOverwriteMode(true);
             }} 
             className="bg-red-900/30 text-red-400 px-3 py-1 rounded text-xs border border-red-500/30 hover:bg-red-900/50 flex items-center gap-1"
         >
             <Eraser size={12} /> 清除
         </button>
      );

      // NUMBER TYPE (Keypad)
      if (col.type === 'number') {
          return (
              <div className="flex flex-col h-full">
                  {renderPanelHeader(col.name, player, extraControls)}
                  <div className="flex-1 min-h-0">
                    <NumericKeypad 
                        value={currentValue}
                        onChange={(val) => updateScore(player.id, col.id, val)}
                        onNext={moveToNextCell}
                        direction={advanceDirection}
                        column={col} // Pass column prop here
                        overwrite={overwriteMode}
                        setOverwrite={setOverwriteMode}
                    />
                  </div>
              </div>
          );
      } 
      
      let content: React.ReactNode = null;

      // UNIFIED BOOLEAN AND SELECT (List)
      if (col.type === 'boolean' || col.type === 'select') {
          // Normalizing options
          let options: { label: string, value: any, scoreDisplay: number }[] = [];
          
          if (col.type === 'boolean') {
              options = [
                  { label: 'YES (達成)', value: true, scoreDisplay: col.weight ?? 0 },
                  { label: 'NO (未達成)', value: false, scoreDisplay: 0 }
              ];
          } else {
              options = col.options?.map(o => ({
                  label: o.label,
                  value: o.value,
                  scoreDisplay: o.value
              })) || [];
          }

          content = (
              <div className="h-full overflow-hidden flex flex-col">
                 <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 p-1">
                     {options.map((opt, i) => {
                         // Check if active
                         const isActive = col.type === 'boolean' 
                            ? currentValue === opt.value
                            : (typeof currentValue === 'number' ? currentValue : currentValue?.value) === opt.value;

                         return (
                            <button 
                                key={i} 
                                onClick={() => { updateScore(player.id, col.id, opt.value); moveToNextCell(); }} 
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-95 ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-white' : 'border-slate-500'}`}>
                                        {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                    <span className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-300'}`}>{opt.label}</span>
                                </div>
                                <span className={`text-sm font-mono px-2 py-1 rounded ${isActive ? 'bg-black/20 text-white' : 'bg-slate-900 text-emerald-400'}`}>
                                    {opt.scoreDisplay} 分
                                </span>
                            </button>
                         );
                     })}
                     {options.length === 0 && (
                         <div className="text-center text-slate-500 py-8 italic">沒有可用的選項</div>
                     )}
                 </div>
              </div>
          );

      } else {
          // TEXT TYPE
          content = (
              <textarea 
                value={currentValue || ''} 
                onFocus={(e) => e.target.select()} 
                onChange={(e) => updateScore(player.id, col.id, e.target.value)} 
                className="w-full h-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-xl text-white outline-none focus:border-emerald-500 resize-none" 
                placeholder="輸入文字筆記..." 
              />
          );
      }

      return (
          <div className="flex flex-col h-full bg-slate-900">
              {renderPanelHeader(col.name, player, extraControls)}
              <UnifiedInputLayout 
                  leftContent={content} 
                  onNext={moveToNextCell} 
                  advanceDirection={advanceDirection}
              />
          </div>
      );
  };

  const winners = session.players.filter(p => p.totalScore === Math.max(...session.players.map(pl => pl.totalScore))).map(p => p.id);
  
  // Calculate Layout State
  // Score Input: 45vh panel
  // Name Input (History): 45vh panel
  // Name Input (Focused/Keyboard): ~0px visual offset from bottom (browser keyboard logic)
  // Closed: 0px
  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  const panelHeight = editingCell ? '45vh' : (editingPlayerId && !isInputFocused ? '45vh' : '0px');

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden relative">
        <ConfirmationModal 
            isOpen={showResetConfirm}
            title="確定重置？"
            message="此動作將清空所有已輸入的分數，且無法復原。"
            confirmText="確定重置"
            isDangerous={true}
            onCancel={() => setShowResetConfirm(false)}
            onConfirm={() => { onResetScores(); setShowResetConfirm(false); }}
        />

        <ConfirmationModal 
            isOpen={!!columnToDelete}
            title="確定刪除此項目？"
            message="刪除後，所有玩家在該項目的分數將會遺失。"
            confirmText="確定刪除"
            isDangerous={true}
            onCancel={() => setColumnToDelete(null)}
            onConfirm={confirmDeleteColumn}
        />

        {editingColumn && (
            <ColumnConfigEditor 
                column={editingColumn} 
                onSave={(updates) => {
                    const newCols = template.columns.map(c => c.id === editingColumn.id ? { ...c, ...updates } : c);
                    onUpdateTemplate({ ...template, columns: newCols });
                    setEditingColumn(null);
                    setEditingCell(null);
                    setEditingPlayerId(null);
                }}
                onDelete={() => setColumnToDelete(editingColumn.id)}
                onClose={() => setEditingColumn(null)}
            />
        )}

        {/* Top Bar */}
        <div className="flex-none bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700 shadow-md z-20">
             <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                 <button onClick={onExit} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 shrink-0"><ArrowLeft size={20} /></button>
                 
                 {/* Title Editor */}
                 {isEditingTitle ? (
                    <input 
                        autoFocus
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onBlur={handleTitleSubmit}
                        onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                        className="bg-slate-900 text-white font-bold text-lg px-2 py-1 rounded border border-emerald-500 w-full outline-none"
                    />
                 ) : (
                    <div 
                        onClick={() => {
                            setTempTitle(template.name);
                            setIsEditingTitle(true);
                        }}
                        className="font-bold text-lg truncate flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded transition-colors group"
                    >
                        {template.name}
                        <Edit2 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                 )}
             </div>
             <div className="flex items-center gap-1 relative shrink-0">
                 <button 
                    onClick={handleAddColumn} 
                    className="p-2 hover:bg-slate-700 hover:text-emerald-400 rounded-lg text-slate-400"
                    title="新增項目"
                 >
                     <ListPlus size={20} />
                 </button>
                 <button onClick={() => {
                     setShowResetConfirm(true);
                     setEditingCell(null);
                     setEditingPlayerId(null);
                 }} className="p-2 hover:bg-slate-700 hover:text-red-400 rounded-lg text-slate-400"><RotateCcw size={20} /></button>
                 
                 <div className="w-px h-6 bg-slate-700 mx-1"></div>

                 <button 
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="p-2 hover:bg-slate-700 hover:text-indigo-400 rounded-lg text-slate-400"
                 >
                    <Share2 size={20} />
                 </button>

                 {/* Share Menu Popover */}
                 {showShareMenu && (
                     <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                         <button 
                            onClick={handleScreenshot}
                            disabled={isCopying}
                            className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
                         >
                            <Image size={16} className="text-emerald-400" />
                            {isCopying ? '擷取中...' : '複製圖片 (截圖)'}
                         </button>
                         {/* Future options will go here */}
                     </div>
                 )}
                 {showShareMenu && (
                     <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)}></div>
                 )}
             </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col" onClick={() => { setEditingCell(null); setEditingPlayerId(null); }}>
            {/* Table Scroll View */}
            <div className="absolute inset-0 z-0 overflow-auto bg-slate-900 custom-scrollbar pb-32" ref={tableContainerRef} onScroll={handleTableScroll}>
                 <div className="min-w-fit relative">
                    {/* Header Row */}
                    <div className="flex sticky top-0 z-20">
                        <div className="sticky left-0 w-[70px] bg-slate-800 border-r border-b border-slate-700 p-2 flex items-center justify-center z-30 shadow-sm"><Trophy size={20} className="text-emerald-500" /></div>
                        {session.players.map(p => (
                            <div 
                                key={p.id} 
                                onClick={(e) => handleHeaderClick(p.id, e)}
                                className={`min-w-[54px] flex-1 border-r border-b border-slate-700 p-2 flex flex-col items-center justify-center relative cursor-pointer transition-all ${editingPlayerId === p.id ? 'z-20 ring-2 ring-inset ring-white/50' : 'hover:bg-slate-800'}`}
                                style={{ 
                                    backgroundColor: `${p.color}20`, // 20% opacity of player color
                                    borderBottomColor: p.color,
                                    borderBottomWidth: '2px'
                                }}
                            >
                                <span className="text-xs font-bold truncate max-w-full" style={{ color: p.color }}>{p.name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Data Rows */}
                    {template.columns.map(col => {
                        const isDragging = draggingId === col.id;
                        const isDropTarget = dropTargetId === col.id;
                        
                        return (
                            <div 
                                key={col.id} 
                                id={`row-${col.id}`} 
                                className={`flex relative z-10 transition-all ${isDragging ? 'opacity-40' : 'opacity-100'} ${isDropTarget ? 'border-t-2 border-emerald-500' : ''}`}
                            >
                                <div 
                                    onClick={(e) => handleHeaderCellClick(e, col)}
                                    // Desktop DnD
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, col.id)}
                                    onDragOver={(e) => handleDragOver(e, col.id)}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    // Touch DnD (Long Press)
                                    onTouchStart={(e) => handleTouchStart(e, col.id)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    data-row-id={col.id}
                                    className={`sticky left-0 w-[70px] bg-slate-800 border-r border-b border-slate-700 p-2 flex flex-col justify-center cursor-pointer hover:bg-slate-700 transition-colors z-20 group select-none ${isDragging ? 'cursor-grabbing bg-slate-700' : 'cursor-grab'}`}
                                >
                                    <span className="text-xs font-bold text-slate-300 w-full text-center break-words whitespace-normal leading-tight">{col.name}</span>
                                    {col.isScoring && (
                                        <div className="text-[10px] text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                                            {col.type === 'select' ? (
                                                <div className="flex items-center gap-1">
                                                    <Settings size={10} />
                                                    {col.unit && <span className="scale-90">{col.unit}</span>}
                                                </div>
                                            ) : (
                                                col.weight !== 1 ? (
                                                    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap w-full">
                                                        <span className="text-emerald-500 font-bold font-mono">{col.weight}</span>
                                                        <span className="text-slate-600 text-[9px]">×</span>
                                                        <span className="truncate max-w-[40px]">{col.unit}</span>
                                                    </div>
                                                ) : (
                                                    col.unit && <span className="scale-90 truncate max-w-full">{col.unit}</span>
                                                )
                                            )}
                                        </div>
                                    )}
                                    {/* Drag Handle Indicator (Visual Only) */}
                                    <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
                                        <GripVertical size={12} />
                                    </div>
                                </div>
                                {session.players.map(p => (
                                    <ScoreCell 
                                        key={p.id}
                                        player={p}
                                        column={col}
                                        isActive={editingCell?.playerId === p.id && editingCell?.colId === col.id}
                                        onClick={(e) => handleCellClick(p.id, col.id, e)}
                                    />
                                ))}
                            </div>
                        );
                    })}
                    
                    {/* Dynamic Spacer: Immediate Height Change (No transition) to fix scroll race condition */}
                    <div className={`w-full pointer-events-none ${isPanelOpen ? 'h-[60vh]' : 'h-0'}`} />
                 </div>
            </div>
        </div>

        {/* Total Score Bar - Floating Absolute */}
        <div 
            className="absolute left-0 right-0 h-12 bg-slate-900 border-t border-slate-700 flex z-30 overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out"
            style={{ bottom: panelHeight }}
        >
            <div className="w-[70px] bg-slate-800 border-r border-slate-700 flex items-center justify-center shrink-0 z-40 relative">
                    <span className="font-black text-emerald-400 italic text-sm">TOTAL</span>
            </div>
            <div className="flex-1 overflow-x-auto no-scrollbar" ref={totalBarScrollRef}>
                <div className="flex min-w-fit">
                    {session.players.map(p => (
                        <div 
                            key={p.id} 
                            className="min-w-[54px] flex-1 border-r border-slate-800 flex items-center justify-center relative"
                            style={{ 
                                backgroundColor: `${p.color}20`,
                                borderTopColor: p.color,
                                borderTopWidth: '2px'
                            }}
                        >
                            <span className="font-black text-lg" style={{ color: p.color }}>{p.totalScore}</span>
                            {winners.includes(p.id) && session.players.length > 1 && (
                                <Crown size={14} className="text-yellow-400 absolute top-1 right-1" fill="currentColor" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Bottom Input Panel */}
        <div 
            className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ height: (editingPlayerId && isInputFocused) ? 'auto' : panelHeight }}
        >
            {editingPlayerId ? renderPlayerEditor() : editingCell ? renderScoreEditor() : null}
        </div>
        
        {/* Invisible Screenshot Target */}
        <div 
            id="screenshot-target" 
            className="fixed top-0 left-[-9999px] bg-slate-900 text-slate-100 p-4"
            style={{ width: Math.max(400, 70 + session.players.length * 60) + 'px' }}
        >
             <div className="mb-4 flex items-center gap-2">
                 <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20"><Trophy className="text-emerald-500" /></div>
                 <div>
                     <h2 className="text-2xl font-bold">{template.name}</h2>
                     <p className="text-slate-500 text-xs">萬用桌遊計分板 BoardGameScorePad • {new Date().toLocaleDateString()}</p>
                 </div>
             </div>
             <div className="border border-slate-700 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex bg-slate-800 border-b border-slate-700">
                    <div className="w-[70px] p-3 border-r border-slate-700 font-bold text-slate-400 text-sm flex items-center justify-center text-center">計分項目</div>
                    {session.players.map(p => (
                        <div key={p.id} className="w-[60px] flex-1 p-3 border-r border-slate-700 text-center font-bold" style={{ color: p.color, backgroundColor: `${p.color}10` }}>
                            {p.name}
                        </div>
                    ))}
                </div>
                {/* Rows */}
                {template.columns.map(col => (
                     <div key={col.id} className="flex border-b border-slate-800">
                         <div className="w-[70px] p-3 border-r border-slate-800 bg-slate-800/50 text-xs font-bold text-slate-300 flex flex-col items-center justify-center text-center break-words">
                             {col.name}
                             {col.isScoring && (
                                <div className="text-[10px] text-slate-500 mt-1 flex flex-col items-center">
                                     {col.weight !== 1 ? (
                                         <span className="flex items-center gap-0.5">
                                            <span className="text-emerald-500 font-bold">{col.weight}</span>
                                            <span>×</span>
                                            <span>{col.unit}</span>
                                         </span>
                                     ) : (
                                         <span>{col.unit}</span>
                                     )}
                                </div>
                             )}
                         </div>
                         {session.players.map(p => (
                             <div key={p.id} className="w-[60px] flex-1 p-2 border-r border-slate-800 flex items-center justify-center relative min-h-[50px]">
                                 <ScoreCell player={p} column={col} isActive={false} onClick={() => {}} />
                             </div>
                         ))}
                     </div>
                ))}
                {/* Total */}
                <div className="flex bg-slate-800 border-t-2 border-slate-700">
                    <div className="w-[70px] p-3 border-r border-slate-700 font-black text-emerald-400 italic text-center flex items-center justify-center">TOTAL</div>
                    {session.players.map(p => (
                         <div key={p.id} className="w-[60px] flex-1 p-3 border-r border-slate-700 text-center font-black text-xl" style={{ color: p.color, backgroundColor: `${p.color}10` }}>
                             {p.totalScore}
                         </div>
                    ))}
                </div>
             </div>
        </div>
    </div>
  );
};

export default SessionView;
