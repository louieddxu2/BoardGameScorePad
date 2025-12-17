import React from 'react';
import { Image, LayoutPanelLeft } from 'lucide-react';

interface ShareMenuProps {
  isCopying: boolean;
  onScreenshotRequest: (mode: 'full' | 'simple') => void;
}

const ShareMenu: React.FC<ShareMenuProps> = ({ isCopying, onScreenshotRequest }) => {
  return (
    <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
      <button
        onClick={() => onScreenshotRequest('full')}
        disabled={isCopying}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <Image size={16} className="text-emerald-400" />
        {isCopying ? '處理中...' : '複製完整截圖'}
      </button>
      <button
        onClick={() => onScreenshotRequest('simple')}
        disabled={isCopying}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <LayoutPanelLeft size={16} className="text-sky-400" />
        {isCopying ? '處理中...' : '複製簡潔截圖'}
      </button>
    </div>
  );
};

export default ShareMenu;