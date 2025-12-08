import React, { useState } from 'react';
import { ArrowLeft, ListPlus, RotateCcw, Share2, Edit2 } from 'lucide-react';
import ShareMenu from '../modals/ShareMenu';

interface SessionHeaderProps {
  templateName: string;
  isEditingTitle: boolean;
  showShareMenu: boolean;
  isCopying: boolean;
  onEditTitleToggle: (editing: boolean) => void;
  onTitleSubmit: (newTitle: string) => void;
  onExit: () => void;
  onAddColumn: () => void;
  onReset: () => void;
  onShareMenuToggle: (show: boolean) => void;
  onScreenshot: () => void;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({
  templateName,
  isEditingTitle,
  showShareMenu,
  isCopying,
  onEditTitleToggle,
  onTitleSubmit,
  onExit,
  onAddColumn,
  onReset,
  onShareMenuToggle,
  onScreenshot
}) => {
  const [tempTitle, setTempTitle] = useState('');

  const handleTitleClick = () => {
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
          <div onClick={handleTitleClick} className="font-bold text-lg truncate flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded transition-colors group">
            {templateName}
            <Edit2 size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 relative shrink-0">
        <button onClick={onAddColumn} className="p-2 hover:bg-slate-700 hover:text-emerald-400 rounded-lg text-slate-400"><ListPlus size={20} /></button>
        <button onClick={onReset} className="p-2 hover:bg-slate-700 hover:text-red-400 rounded-lg text-slate-400"><RotateCcw size={20} /></button>
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button onClick={() => onShareMenuToggle(!showShareMenu)} className="p-2 hover:bg-slate-700 hover:text-indigo-400 rounded-lg text-slate-400"><Share2 size={20} /></button>
        
        {showShareMenu && <ShareMenu isCopying={isCopying} onScreenshot={onScreenshot} />}
        {showShareMenu && <div className="fixed inset-0 z-40" onClick={() => onShareMenuToggle(false)}></div>}
      </div>
    </div>
  );
};

export default SessionHeader;
