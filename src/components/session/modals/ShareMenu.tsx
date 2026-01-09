
import React from 'react';
import { Image, Upload, Images } from 'lucide-react';

interface ShareMenuProps {
  isCopying: boolean;
  onScreenshotRequest: (mode: 'full' | 'simple') => void;
  hasVisuals?: boolean;
  onUploadImage?: () => void;
  onOpenGallery?: () => void; // New Prop
  photoCount?: number; // New Prop
}

const ShareMenu: React.FC<ShareMenuProps> = ({ 
  isCopying, 
  onScreenshotRequest, 
  hasVisuals, 
  onUploadImage,
  onOpenGallery,
  photoCount = 0
}) => {
  return (
    <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
      <button
        onClick={() => onScreenshotRequest('full')}
        disabled={isCopying}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <Image size={16} className="text-emerald-400" />
        {isCopying ? '處理中...' : '預覽截圖'}
      </button>
      
      {/* Photo Gallery Section */}
      <div className="h-px bg-slate-700 my-1 mx-2"></div>
      
      <button
        onClick={onOpenGallery}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <Images size={16} className="text-indigo-400" />
        <div className="flex flex-col">
            <span>照片圖庫</span>
            <span className="text-[10px] text-slate-500">目前 {photoCount} 張照片</span>
        </div>
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
                設定計分紙背景
            </button>
          </>
      )}
    </div>
  );
};

export default ShareMenu;
