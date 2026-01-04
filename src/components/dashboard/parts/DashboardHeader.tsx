
import React from 'react';
import { Dice5, Search, X, Download, HelpCircle } from 'lucide-react';

interface DashboardHeaderProps {
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isInstalled: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  onShowInstallGuide: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  isSearchActive,
  setIsSearchActive,
  searchQuery,
  setSearchQuery,
  isInstalled,
  canInstall,
  onInstallClick,
  onShowInstallGuide
}) => {
  return (
    <header className="p-2.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center gap-2 shadow-md h-[58px] shrink-0 transition-colors duration-300">
      {isSearchActive ? (
        <div className="flex items-center gap-2 w-full animate-in fade-in duration-300">
          <Search size={20} className="text-emerald-500 shrink-0 ml-1" />
          <input 
            type="text" 
            placeholder="搜尋遊戲..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            autoFocus 
            className="w-full bg-transparent text-white focus:outline-none placeholder-slate-500" 
          />
          <button onClick={() => { setIsSearchActive(false); setSearchQuery(''); }} className="text-slate-400 hover:text-white p-2">
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center w-full animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-emerald-500">
            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
              <Dice5 size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">萬用桌遊計分板</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSearchActive(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              <Search size={20} />
            </button>
            {!isInstalled && (
              <button 
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-white shadow-lg ${canInstall ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`} 
                onClick={canInstall ? onInstallClick : onShowInstallGuide}
              >
                <div className="relative">
                  <Download size={14} />
                  {!canInstall && (
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full w-2.5 h-2.5 flex items-center justify-center border border-slate-700">
                      <HelpCircle size={8} className="text-slate-900" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="hidden sm:inline">安裝 App</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default DashboardHeader;
