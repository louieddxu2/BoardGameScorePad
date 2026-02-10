
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedListItem } from '../../../types';
import { GameOption } from '../types';
import { MapPin, Users, Minus, Plus, Play, ChevronUp, Search, Calendar, PenLine, List, ChevronDown } from 'lucide-react';
import { getRecommendations, getSearchResults } from '../utils/sortStrategies';

interface StartGamePanelProps {
  options: GameOption[]; 
  locations?: SavedListItem[];
  onStart: (option: GameOption, playerCount: number, location: string) => void;
  onSearchClick: () => void;
  isSearching?: boolean;
  searchQuery?: string; // [New] Needed for creating virtual option
}

const StartGamePanel = React.forwardRef<HTMLDivElement, StartGamePanelProps>(({ 
  options, 
  locations = [], 
  onStart, 
  onSearchClick,
  isSearching = false,
  searchQuery = ''
}, ref) => {
  // --- Derived Data ---
  const uniqueLocations = useMemo(() => {
      return locations.map(l => l.name).reverse();
  }, [locations]);

  const hasLocationHistory = uniqueLocations.length > 0;

  // --- Local State ---
  const [playerCount, setPlayerCount] = useState(4);
  const [location, setLocation] = useState('');
  const [selectedOptionUid, setSelectedOptionUid] = useState<string | null>(null);
  
  const [isManualInput, setIsManualInput] = useState(!hasLocationHistory);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- Logic: Process Options (Sort & Slice & Inject) ---
  const processedOptions = useMemo(() => {
    if (isSearching) {
       // 搜尋模式：使用新策略 (包含虛擬選項注入)
       return getSearchResults(options, searchQuery);
    } else {
       // 預設模式：使用推薦邏輯
       return getRecommendations(options);
    }
  }, [options, isSearching, searchQuery]);

  // --- Effects ---

  // 1. Auto-select/validate template based on processedOptions
  useEffect(() => {
      if (processedOptions.length > 0) {
          // [Fix] 簡化邏輯：當列表內容改變時（例如搜尋關鍵字變化），總是優先選取第一項（最佳匹配）。
          // 這解決了當虛擬選項 (__CREATE_NEW__) 仍然在列表中（變為最後一項）時，Dock 沒有自動切換回第一項的問題。
          const topItem = processedOptions[0];
          setSelectedOptionUid(topItem.uid);
          
          // 如果該選項有預設人數，則套用
          if (topItem.defaultPlayerCount) {
              setPlayerCount(topItem.defaultPlayerCount);
          }
      } else {
          setSelectedOptionUid(null);
      }
  }, [processedOptions]);

  // 2. Smart Focus Logic
  useEffect(() => {
      if (isManualInput && hasLocationHistory && inputRef.current) {
          inputRef.current.focus();
      }
  }, [isManualInput, hasLocationHistory]);

  // 3. Reset manual mode if history becomes available
  useEffect(() => {
      if (uniqueLocations.length === 0) {
          setIsManualInput(true);
      } else {
          if (!location) {
             setIsManualInput(false);
          }
      }
  }, [uniqueLocations.length]);

  // 4. Auto-scroll to bottom when menu opens
  useEffect(() => {
      if (showLocationMenu && listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
      }
  }, [showLocationMenu]);

  const dockedItem = useMemo(() => {
      if (selectedOptionUid) {
          const found = processedOptions.find(t => t.uid === selectedOptionUid);
          if (found) return found;
      }
      
      // Fallback: 如果 State 為空但有選項，預設選第一個
      if (processedOptions.length > 0) {
          return processedOptions[0];
      }
      
      return null;
  }, [processedOptions, selectedOptionUid]);

  const scrollableItems = useMemo(() => {
      // 如果沒有 Docked Item，則顯示所有項目
      if (!dockedItem) return processedOptions;
      
      // 否則過濾掉已 Dock 的項目
      // [Fix] 移除原本的 .slice(0, 4) 限制。
      // processedOptions 在搜尋模式下已經由 getSearchResults 限制了數量 (5 + 1)。
      // 這裡不應該再裁切，否則會導致第 6 個項目 (通常是建立新遊戲) 被隱藏。
      return processedOptions.filter(t => t.uid !== dockedItem.uid);
  }, [processedOptions, dockedItem]);

  // --- Handlers ---

  const handleOptionClick = (t: GameOption) => {
      setSelectedOptionUid(t.uid);
      if (t.defaultPlayerCount) setPlayerCount(t.defaultPlayerCount);
  };

  const handleStart = () => {
      if (dockedItem) {
          onStart(dockedItem, playerCount, location);
      }
  };

  const handleLocationSelect = (loc: string) => {
      setLocation(loc);
      setShowLocationMenu(false);
  };

  const switchToManual = () => {
      setIsManualInput(true);
      setShowLocationMenu(false);
  };

  const switchToList = () => {
      setIsManualInput(false);
      setShowLocationMenu(true); 
  };

  const handleBoxClick = () => {
      if (showLocationMenu) {
          switchToManual();
      } else {
          setShowLocationMenu(true);
      }
  };

  // Constants
  const ROW_HEIGHT = "h-[56px]";
  const RIGHT_PANEL_WIDTH = "w-[140px]"; 

  const renderItem = (option: GameOption, isDocked: boolean = false) => {
      const isSelected = isDocked; 
      const isSavedGameOnly = !option.templateId && option.savedGameId;
      const isVirtual = option.uid === '__CREATE_NEW__';

      return (
           <div key={option.uid} className={`${ROW_HEIGHT} w-full relative group shrink-0`}>
               <button
                   onClick={() => handleOptionClick(option)}
                   className={`absolute inset-0 w-full flex items-center justify-between px-4 text-left transition-all ${isSelected ? 'bg-slate-800 z-10' : 'bg-transparent text-slate-400 hover:bg-slate-800/50'}`}
               >
                   <div className="min-w-0 flex-1">
                       <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : ''} ${isVirtual ? 'text-emerald-400' : ''}`}>
                           {isVirtual ? `建立並計分 "${option.displayName}"` : option.displayName}
                       </div>
                       <div className="text-[10px] opacity-60 flex items-center gap-1 mt-0.5">
                           {isVirtual ? <Plus size={10} /> : <Calendar size={10} />}
                           {isVirtual ? '快速開始' : (option.defaultPlayerCount ? `${option.defaultPlayerCount}人` : '未設定')}
                           {isSavedGameOnly && <span className="ml-1 px-1 bg-slate-700/50 rounded text-slate-400">簡易</span>}
                       </div>
                   </div>
               </button>
               {!isDocked && <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-800 pointer-events-none"></div>}
           </div>
      );
  };

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 h-[220px] bg-slate-900 border-t border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 flex flex-row animate-in slide-in-from-bottom-full duration-300">
      
      {/* --- LEFT: Game List --- */}
      <div className="flex-1 relative flex flex-col bg-slate-900 min-h-0 border-r border-slate-800">
          <div className="absolute top-0 left-0 right-0 p-1 text-center pointer-events-none z-10 opacity-30">
             <ChevronUp size={12} className="text-slate-500 mx-auto" />
          </div>
          
          {processedOptions.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 pb-10">
                   <Search size={32} />
                   <span className="text-xs mt-2">無符合遊戲</span>
               </div>
          ) : (
               <>
                   <div className="flex-1 flex flex-col-reverse justify-start overflow-y-auto no-scrollbar">
                       {scrollableItems.map(opt => renderItem(opt, false))}
                       <div className="h-2 shrink-0"></div> 
                   </div>
                   <div className={`flex-none ${ROW_HEIGHT} relative z-30 border-t border-slate-800 bg-slate-900 shadow-[0_-4px_15px_rgba(0,0,0,0.3)]`}>
                        {dockedItem ? (
                            renderItem(dockedItem, true)
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs italic opacity-70">
                                請選擇...
                            </div>
                        )}
                   </div>
               </>
          )}
      </div>

      {/* --- RIGHT: Controls --- */}
      <div className={`${RIGHT_PANEL_WIDTH} flex flex-col bg-slate-950 shrink-0 relative`}>
          
          {/* 1. Location (Top) */}
          <div className="flex-1 p-2 flex flex-col justify-center border-b border-slate-800/50 relative z-20">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <MapPin size={10} /> 地點
              </label>

              {isManualInput ? (
                  <div className="relative w-full">
                      <input 
                          ref={inputRef}
                          type="text" 
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="在哪玩?"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 pr-7 text-sm text-white focus:border-emerald-500 outline-none placeholder-slate-600"
                      />
                      {hasLocationHistory && (
                          <button 
                              onClick={switchToList}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                              title="選擇歷史地點"
                          >
                              <List size={14} />
                          </button>
                      )}
                  </div>
              ) : (
                  <div className="relative">
                      <button 
                          onClick={handleBoxClick}
                          className={`w-full flex items-center justify-between bg-slate-900 border rounded-lg p-2 text-sm outline-none transition-colors text-left
                              ${showLocationMenu 
                                  ? 'border-emerald-500 text-emerald-400 bg-emerald-900/10 relative z-20' 
                                  : 'border-slate-700 hover:border-slate-600 text-white'
                              }
                          `}
                      >
                          {showLocationMenu ? (
                              <span className="flex items-center gap-2 font-bold animate-in fade-in duration-200">
                                  <PenLine size={14} />
                                  新地點
                              </span>
                          ) : (
                              <span className={`truncate ${!location ? 'text-slate-500' : ''}`}>
                                  {location || '選擇地點...'}
                              </span>
                          )}
                          
                          <ChevronUp 
                              size={14} 
                              className={`shrink-0 ml-1 transition-transform duration-200 ${showLocationMenu ? 'rotate-180 text-emerald-500' : 'text-slate-500'}`} 
                          />
                      </button>

                      {showLocationMenu && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowLocationMenu(false)} />
                            <div 
                                ref={listRef}
                                className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20 max-h-72 overflow-y-auto no-scrollbar flex flex-col animate-in slide-in-from-bottom-2 duration-200"
                            >
                                {uniqueLocations.map((loc, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleLocationSelect(loc)}
                                        className="w-full text-left px-3 py-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white border-b border-slate-700/50 last:border-0 truncate font-medium shrink-0 leading-normal block"
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                          </>
                      )}
                  </div>
              )}
          </div>

          {/* 2. Player Count (Middle) */}
          <div className="flex-1 p-2 flex flex-col justify-center items-center z-10">
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1 self-start w-full">
                  <Users size={10} /> 人數
              </label>
              <div className="flex items-center justify-between w-full bg-slate-900 rounded-xl p-1 border border-slate-700">
                  <button 
                      onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg active:scale-90 transition-transform hover:bg-slate-700"
                  >
                      <Minus size={14} />
                  </button>
                  <span className="text-xl font-black text-white font-mono">{playerCount}</span>
                  <button 
                      onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                      className="w-8 h-8 flex items-center justify-center bg-emerald-900/30 text-emerald-400 rounded-lg active:scale-90 transition-transform border border-emerald-500/30 hover:bg-emerald-900/50"
                  >
                      <Plus size={14} />
                  </button>
              </div>
          </div>

          {/* 3. Bottom Actions */}
          <div className="flex-none h-[60px] flex border-t border-slate-800 z-10">
              <button
                  onClick={onSearchClick}
                  className="w-[50px] h-full flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-emerald-500 transition-colors active:brightness-90 border-r border-slate-800"
                  title="搜尋更多"
              >
                  <Search size={22} strokeWidth={2.5} />
              </button>

              <button
                  onClick={handleStart}
                  disabled={!dockedItem}
                  className={`
                      w-[90px] h-full flex flex-col items-center justify-center transition-all active:brightness-90
                      ${dockedItem 
                          ? (dockedItem.uid === '__CREATE_NEW__' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white')
                          : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      }
                  `}
              >
                  {dockedItem?.uid === '__CREATE_NEW__' ? <Plus size={28} /> : <Play size={28} fill="currentColor" />}
              </button>
          </div>
      </div>

    </div>
  );
});

StartGamePanel.displayName = 'StartGamePanel';

export default StartGamePanel;
