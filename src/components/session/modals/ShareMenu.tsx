import React from 'react';
import { Image, LayoutPanelLeft, Upload } from 'lucide-react';

interface ShareMenuProps {
  isCopying: boolean;
  onScreenshotRequest: (mode: 'full' | 'simple') => void;
  hasVisuals?: boolean;
  onUploadImage?: () => void;
}

const ShareMenu: React.FC<ShareMenuProps> = ({ isCopying, onScreenshotRequest, hasVisuals, onUploadImage }) => {
  return (
    <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
      <button
        onClick={() => onScreenshotRequest('full')}
        disabled={isCopying}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <Image size={16} className="text-emerald-400" />
        {isCopying ? '處理中...' : '預覽截圖 (完整)'}
      </button>
      <button
        onClick={() => onScreenshotRequest('simple')}
        disabled={isCopying}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <LayoutPanelLeft size={16} className="text-sky-400" />
        {isCopying ? '處理中...' : '預覽截圖 (簡潔)'}
      </button>
      
      {/* 
        Show Upload Image option if the template has coordinate data (visuals) but image might be missing or user wants to update it.
        This serves as a manual trigger for the "Missing Image" modal logic.
      */}
      {hasVisuals && onUploadImage && (
          <>
            <div className="h-px bg-slate-700 my-1 mx-2"></div>
            <button
                onClick={onUploadImage}
                className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
            >
                <Upload size={16} className="text-yellow-400" />
                設定背景圖片
            </button>
          </>
      )}
    </div>
  );
};

export default ShareMenu;