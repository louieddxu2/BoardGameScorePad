
import React, { useState } from 'react';
import { ArrowLeft, ListPlus, RotateCcw, Share2, Edit2, Lock, Unlock, DownloadCloud } from 'lucide-react';
import ShareMenu from '../modals/ShareMenu';

interface SessionHeaderProps {
  templateName: string;
  isEditingTitle: boolean;
  showShareMenu: boolean;
  screenshotActive: boolean;
  isEditMode: boolean; // New prop
  hasVisuals?: boolean; // New prop: Check if template has coordinate data
  hasCloudImage?: boolean; // New prop: Check if template has a cloud image ID
  onEditTitleToggle: (editing: boolean) => void;
  onTitleSubmit: (newTitle: string) => void;
  onExit: () => void;
  onAddColumn: () => void;
  onReset: () => void;
  onShareMenuToggle: (show: boolean) => void;
  onScreenshotRequest: (mode: 'full' | 'simple') => void;
  onToggleEditMode: () => void; // New callback
  onUploadImage?: () => void; // New callback
  onCloudDownload?: () => void; // New callback
  onOpenGallery?: () => void; // New callback for gallery
  photoCount?: number;
  isCloudConnected?: boolean;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({
  templateName,
  isEditingTitle,
  showShareMenu,
  screenshotActive,
  isEditMode,
  hasVisuals,
  hasCloudImage,
  onEditTitleToggle,
  onTitleSubmit,
  onExit,
  onAddColumn,
  onReset,
  onShareMenuToggle,
  onScreenshotRequest,
  onToggleEditMode,
  onUploadImage,
  onCloudDownload,
  onOpenGallery,
  photoCount,
  isCloudConnected
}) => {
  const [tempTitle, setTempTitle] = useState('');

  const handleTitleClick = () => {
    // Only allow title editing if in Edit Mode
    if (!isEditMode) return;
    setTempTitle(templateName);
    onEditTitleToggle(true);
  };

  const handleTitleBlur = () => {
    onTitleSubmit(tempTitle);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex-none bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700 shadow-md z-20">
      <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
        <button onClick={onExit} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 shrink-0"><ArrowLeft size={20} /></button>
        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            className="bg-slate-900 text-white font-bold text-lg px-2 py-1 rounded border border-emerald-500 w-full outline-none"
          />
        ) : (
          <div 
            onClick={handleTitleClick} 
            className={`font-bold text-lg truncate flex items-center gap-2 px-2 py-1 rounded transition-colors group ${isEditMode ? 'cursor-pointer hover:bg-slate-700/50' : ''}`}
          >
            {templateName}
            {isEditMode && <Edit2 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 relative shrink-0">
        {/* Cloud Download Shortcut */}
        {hasCloudImage && onCloudDownload && (
            <button 
                onClick={onCloudDownload} 
                className="p-2 rounded-lg transition-colors border border-sky-500/30 bg-sky-900/20 text-sky-400 animate-pulse hover:bg-sky-900/40"
                title="下載雲端背景圖"
            >
                <DownloadCloud size={20} />
            </button>
        )}

        <button 
            onClick={onToggleEditMode} 
            className={`p-2 rounded-lg transition-colors border ${isEditMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
            title={isEditMode ? "鎖定編輯 (切換至使用模式)" : "解鎖編輯 (切換至編輯模式)"}
        >
            {isEditMode ? <Unlock size={20} /> : <Lock size={20} />}
        </button>
        
        {/* Only show Add Column button in Edit Mode */}
        {isEditMode && (
            <button onClick={onAddColumn} className="p-2 hover:bg-slate-700 hover:text-emerald-400 rounded-lg text-slate-400"><ListPlus size={20} /></button>
        )}
        
        <button onClick={onReset} className="p-2 hover:bg-slate-700 hover:text-red-400 rounded-lg text-slate-400"><RotateCcw size={20} /></button>
        
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button onClick={() => onShareMenuToggle(!showShareMenu)} className="p-2 hover:bg-slate-700 hover:text-indigo-400 rounded-lg text-slate-400"><Share2 size={20} /></button>
        
        {showShareMenu && (
            <ShareMenu 
                isCopying={screenshotActive} 
                onScreenshotRequest={onScreenshotRequest} 
                hasVisuals={hasVisuals}
                onUploadImage={onUploadImage}
                onOpenGallery={onOpenGallery}
                photoCount={photoCount}
            />
        )}
        {showShareMenu && <div className="fixed inset-0 z-40" onClick={() => onShareMenuToggle(false)}></div>}
      </div>
    </div>
  );
};

export default SessionHeader;
