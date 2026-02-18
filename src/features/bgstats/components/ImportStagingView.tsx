
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ImportAnalysisReport, ImportManualLinks } from '../types';
import { LayoutGrid, Users, MapPin, ArrowRight, AlertTriangle, CheckCircle, Database, FileJson, Search, X } from 'lucide-react';
import { useImportLinking } from '../hooks/useImportLinking';
import { LinkerList, LinkerItemProps } from './LinkerList';

interface ImportStagingViewProps {
  report: ImportAnalysisReport;
  onConfirm: (links: ImportManualLinks) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const ImportStagingView: React.FC<ImportStagingViewProps> = ({ report, onConfirm, onCancel, isProcessing }) => {
  // [Logic] Determine available tabs dynamically based on data presence
  // If a category has no local unmatched, no import unmatched, and no matched items, we hide it.
  // This handles the "BGG Import" case where players/locations are empty.
  const tabs = useMemo(() => {
      const allTabs = [
          { id: 'games', label: '遊戲', icon: LayoutGrid, data: report.games },
          { id: 'players', label: '玩家', icon: Users, data: report.players },
          { id: 'locations', label: '地點', icon: MapPin, data: report.locations },
      ];
      
      return allTabs.filter(t => {
          const hasLocal = t.data.localUnmatched.length > 0;
          const hasImport = t.data.importUnmatched.length > 0;
          const hasMatched = t.data.matchedCount > 0;
          return hasLocal || hasImport || hasMatched;
      });
  }, [report]);

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'games');
  
  // Ensure activeTab is valid when tabs change (e.g., if switching data sources)
  useEffect(() => {
      if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
          setActiveTab(tabs[0].id);
      }
  }, [tabs, activeTab]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // We need separate hooks for each category to preserve state when switching tabs
  const gameLinking = useImportLinking({ categoryData: report.games, categoryType: 'game' });
  const playerLinking = useImportLinking({ categoryData: report.players, categoryType: 'player' });
  const locationLinking = useImportLinking({ categoryData: report.locations, categoryType: 'location' });

  // Select active hook based on tab
  const activeHook = activeTab === 'games' ? gameLinking 
                   : activeTab === 'players' ? playerLinking 
                   : locationLinking;

  const currentData = activeTab === 'games' ? report.games 
                    : activeTab === 'players' ? report.players 
                    : report.locations;

  // --- Derived Data: Reverse Lookup for Linked Names ---
  // We need to know: Local ID -> Imported Name (if linked)
  const localToImportNameMap = useMemo(() => {
      const map = new Map<string, string>();
      
      // Iterate over links to build the reverse map
      activeHook.links.forEach((link, importId) => {
          // Find the import item name
          const importItem = currentData.importUnmatched.find(i => i.id === importId);
          if (importItem) {
              map.set(link.targetId, importItem.name);
          }
      });
      return map;
  }, [activeHook.links, currentData.importUnmatched]);

  // --- Scroll Logic ---
  useEffect(() => {
      if (activeHook.lastLinkedLocalId) {
          const targetElement = document.getElementById(`linker-item-${activeHook.lastLinkedLocalId}`);
          if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
      }
  }, [activeHook.lastLinkedLocalId]);

  // Prepare List Data
  const localListItems: LinkerItemProps[] = currentData.localUnmatched.map(item => ({
    id: item.id,
    name: item.name,
    subTitle: item.bggId ? `BGG: ${item.bggId}` : undefined,
    isSelected: activeHook.selectedLocalId === item.id,
    isLinked: localToImportNameMap.has(item.id),
    linkedName: localToImportNameMap.get(item.id)
  }));

  const importListItems: LinkerItemProps[] = activeHook.displayedImportItems.map(item => {
    // Only highlight as "Linked" (Solid Green) if it matches the CURRENTLY selected local item
    const isActuallyLinked = item.id === activeHook.activeLinkedImportId;
    
    // Only highlight as "Suggested" (Dashed Yellow) if it matches search AND isn't the already linked one
    const isSuggested = activeHook.suggestedMatchId === item.id && !isActuallyLinked;

    return {
        id: item.id,
        name: item.name,
        subTitle: (item as any).bggId ? `BGG: ${(item as any).bggId}` : undefined,
        isLinked: isActuallyLinked,
        isSuggested: isSuggested,
        // We don't mark other items as "linked" on the right side to reduce visual noise
    };
  });

  const handleConfirmClick = () => {
    // Return structured links object instead of merged map
    onConfirm({
        games: gameLinking.links,
        players: playerLinking.links,
        locations: locationLinking.links
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
        
        {/* Header Summary */}
        <div className="flex-none p-4 border-b border-slate-800 bg-slate-800/50">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                    <CheckCircle size={20} />
                </div>
                <div>
                    <h3 className="text-white font-bold">分析完成</h3>
                    <p className="text-xs text-slate-400">已自動配對 {report.games.matchedCount} 款遊戲、{report.players.matchedCount} 位玩家、{report.locations.matchedCount} 個地點</p>
                </div>
            </div>
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>請在下方手動連結對應的項目 (先選左邊，再點右邊)。連結後會自動跳至下一項。</span>
            </div>
        </div>

        {/* Tabs - Now dynamic based on data presence */}
        {tabs.length > 1 && (
            <div className="flex-none flex border-b border-slate-800">
                {tabs.map(tab => {
                    const count = tab.data.localUnmatched.length;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className="flex items-center gap-1.5">
                                <Icon size={14} /> {tab.label}
                            </div>
                            {count > 0 && <span className="text-[9px] bg-slate-700 px-1.5 rounded-full">{count} 待處理</span>}
                        </button>
                    );
                })}
            </div>
        )}

        {/* Content (Two Columns using LinkerList) */}
        <div className="flex-1 flex min-h-0">
            {/* Left: Local Unmatched */}
            <div className="flex-1 border-r border-slate-800 flex flex-col min-w-0 bg-slate-900/50">
                <LinkerList 
                  items={localListItems}
                  title={<><Database size={12} /> 本機 ({localListItems.length})</>}
                  onItemClick={activeHook.handleLocalSelect}
                />
            </div>

            {/* Right: Import Unmatched */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
                {/* Search Bar */}
                <div className="p-2 border-b border-slate-800 flex-none">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={activeHook.manualSearchQuery}
                            onChange={(e) => activeHook.setManualSearchQuery(e.target.value)}
                            placeholder="搜尋..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                        />
                        {activeHook.manualSearchQuery && (
                            <button onClick={() => activeHook.setManualSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <LinkerList 
                      items={importListItems}
                      title={<><FileJson size={12} /> 匯入 ({activeHook.totalImportCount})</>}
                      onItemClick={(id) => {
                          activeHook.handleImportSelect(Number(id));
                          // Blur input to dismiss keyboard/focus on link action
                          if (searchInputRef.current) {
                              searchInputRef.current.blur();
                          }
                      }}
                      emptyMessage={activeHook.manualSearchQuery ? "找不到相關項目" : "請從左側選擇項目進行配對"}
                    />
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="flex-none p-4 border-t border-slate-800 bg-slate-800 flex justify-end gap-3">
            <button 
                onClick={onCancel}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 text-sm font-bold transition-colors"
            >
                取消
            </button>
            <button 
                onClick={handleConfirmClick}
                disabled={isProcessing}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                確認並匯入 <ArrowRight size={16} />
            </button>
        </div>
    </div>
  );
};

export default ImportStagingView;
