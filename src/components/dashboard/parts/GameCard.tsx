


import React from 'react';
import { GameTemplate } from '../../../types';
import { Trash2, Pin, Check, Code, PlayCircle, Copy, RefreshCw, UploadCloud, Image as ImageIcon } from 'lucide-react';

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

  // Logic: Compare lastSyncedAt with updatedAt
  const isSynced = (template.lastSyncedAt || 0) >= (template.updatedAt || 0);
  
  // Logic: Image Status
  // globalVisuals implies a grid structure is set up.
  // _localImageAvailable (injected by hook) tells us if the file exists.
  const hasGrid = !!template.globalVisuals;
  const isLocalImageReady = (template as any)._localImageAvailable;

  const renderImageStatus = () => {
      if (!hasGrid) return null;

      // Use p-1.5 to align perfectly with adjacent buttons (which have p-1.5)
      // Size 16 matches the Trash icon size
      if (isLocalImageReady) {
          return (
              <div title="背景圖已就緒" className="p-1.5 text-sky-400 opacity-90">
                  <ImageIcon size={16} />
              </div>
          );
      } else {
          return (
              <div title="需下載或設定背景圖" className="p-1.5 text-slate-600 opacity-60">
                  <ImageIcon size={16} />
              </div>
          );
      }
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

      {/* Bottom Actions (Left) */}
      <div className="absolute bottom-1 left-1 flex gap-1 items-center">
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

        {/* Image Status Indicator - Placed here for better visibility and layout balance */}
        {renderImageStatus()}
      </div>

      {/* Bottom Actions (Right) */}
      <div className="absolute bottom-1 right-1 flex gap-1">
        {/* Only show Upload button if NOT synced (Actionable) */}
        {onCloudBackup && isAutoConnectEnabled && isConnected && !isSynced && (
          <button onClick={onCloudBackup} className="p-1.5 text-amber-400/80 hover:text-amber-300 hover:bg-slate-700 rounded transition-colors" title="有變更！點擊備份到 Google Drive">
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