
import React from 'react';
import { GameTemplate } from '../../../types';
import { Trash2, Pin, Check, Code, PlayCircle, Copy, RefreshCw, UploadCloud, Cloud, CloudOff } from 'lucide-react';

interface GameCardProps {
  template: GameTemplate;
  mode: 'active' | 'pinned' | 'user' | 'system';
  onClick: () => void;
  // Actions
  onDelete?: (e: React.MouseEvent) => void;
  onPin?: (e: React.MouseEvent) => void;
  onCopyJSON?: (e: React.MouseEvent) => void;
  onCloudBackup?: (e: React.MouseEvent) => void;
  onSystemCopy?: (e: React.MouseEvent) => void;
  onSystemRestore?: (e: React.MouseEvent) => void;
  // State
  isCopied?: boolean;
  systemOverride?: boolean;
  // Cloud Sync Status
  isConnected?: boolean;
  isAutoConnectEnabled?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
  template,
  mode,
  onClick,
  onDelete,
  onPin,
  onCopyJSON,
  onCloudBackup,
  onSystemCopy,
  onSystemRestore,
  isCopied,
  systemOverride,
  isConnected,
  isAutoConnectEnabled
}) => {

  const renderSyncIcon = () => {
    if (mode !== 'pinned' && mode !== 'user') return null;
    if (!isAutoConnectEnabled || !isConnected) return null;
    if (!template.lastSyncedAt) return <div title="未上傳雲端"><CloudOff size={14} className="text-slate-500" /></div>;
    const isSynced = template.lastSyncedAt >= (template.updatedAt || 0);
    if (isSynced) return <div title="已同步"><Cloud size={14} className="text-emerald-500" /></div>;
    return (
      <div className="relative" title="待同步">
        <Cloud size={14} className="text-slate-400" />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full border border-slate-800" />
      </div>
    );
  };

  const baseClasses = "bg-slate-800 rounded-xl p-3 shadow-md hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group";
  
  if (mode === 'active') {
    return (
      <div onClick={onClick} className={`${baseClasses} border border-emerald-500/30`}>
        <div className="flex items-start justify-between gap-1 pr-10">
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{template.name}</h3>
        </div>
        <div className="absolute top-1/2 right-3 -translate-y-1/2 text-emerald-500/80">
          <PlayCircle size={36} strokeWidth={1.5} />
        </div>
        <button onClick={onDelete} className="absolute bottom-1 left-1 p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  // Common Layout for Pinned, User, System
  return (
    <div onClick={onClick} className={`${baseClasses} border border-slate-700 ${mode === 'system' ? 'hover:border-indigo-500/50' : 'hover:border-emerald-500/50'}`}>
      <div className="flex items-start justify-between gap-1 pr-7">
        <h3 className={`text-sm font-bold leading-tight line-clamp-2 ${mode === 'system' ? 'text-indigo-100 pr-2' : 'text-white'}`}>{template.name}</h3>
        <div className="shrink-0 mt-0.5">{renderSyncIcon()}</div>
      </div>

      {/* Pin Button */}
      {onPin && (
        <button 
          onClick={onPin} 
          className={`absolute top-1 right-1 p-1.5 rounded-md transition-colors ${mode === 'pinned' ? 'text-yellow-400 bg-slate-700/50 hover:bg-slate-700' : 'text-slate-600 hover:text-yellow-400 hover:bg-slate-700'}`}
        >
          <Pin size={16} fill={mode === 'pinned' ? "currentColor" : "none"} />
        </button>
      )}

      {/* Bottom Actions */}
      <div className="absolute bottom-1 left-1 flex gap-1">
        {onDelete && (
          <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors">
            <Trash2 size={16} />
          </button>
        )}
        
        {/* System Specific Actions */}
        {mode === 'system' && (
          systemOverride ? (
            <button onClick={onSystemRestore} className="flex items-center gap-1 text-[9px] text-yellow-500 font-normal border border-yellow-500/30 px-1.5 py-0.5 rounded hover:bg-yellow-900/20">
              <RefreshCw size={8} /> 備份並還原
            </button>
          ) : (
            <button onClick={onSystemCopy} className="flex items-center gap-1 text-[10px] text-slate-300 font-bold bg-slate-700/50 hover:bg-slate-700 px-1.5 py-1 rounded-md">
              <Copy size={11} /> 建立副本
            </button>
          )
        )}
      </div>

      {/* Bottom Right Actions */}
      <div className="absolute bottom-1 right-1 flex gap-1">
        {mode === 'user' && isAutoConnectEnabled && isConnected && (
          <button onClick={onCloudBackup} className="p-1.5 text-sky-500/70 hover:text-sky-400 rounded transition-colors" title="備份到 Google Drive">
            <UploadCloud size={14} />
          </button>
        )}
        {onCopyJSON && (
          <button onClick={onCopyJSON} className="p-1.5 text-slate-600 hover:text-emerald-400 rounded transition-colors">
            {isCopied ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default GameCard;
