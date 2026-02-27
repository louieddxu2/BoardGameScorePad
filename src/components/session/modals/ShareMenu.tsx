
import React from 'react';
import { Image, Upload, Images, Camera } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface ShareMenuProps {
  isCopying: boolean;
  onScreenshotRequest: (mode: 'full' | 'simple') => void;
  hasVisuals?: boolean;
  onUploadImage?: () => void;
  onOpenGallery?: () => void;
  onTakePhoto?: () => void; // New prop
  photoCount?: number;
}

const ShareMenu: React.FC<ShareMenuProps> = ({
  isCopying,
  onScreenshotRequest,
  hasVisuals,
  onUploadImage,
  onOpenGallery,
  onTakePhoto,
  photoCount = 0
}) => {
  const { t } = useSessionTranslation();
  return (
    <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
      <button
        onClick={() => onScreenshotRequest('full')}
        disabled={isCopying}
        className="flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors text-left"
      >
        <Image size={16} className="text-emerald-400" />
        {isCopying ? t('share_processing') : t('share_preview')}
      </button>

      {/* Photo Gallery Section (Split Button) */}
      <div className="h-px bg-slate-700 my-1 mx-2"></div>

      <div className="flex items-stretch gap-[1px]">
        <button
          onClick={onOpenGallery}
          className="flex-1 flex items-center gap-3 px-3 py-3 hover:bg-slate-700 rounded-l-lg text-sm text-white transition-colors text-left group"
        >
          <Images size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
          <div className="flex flex-col min-w-0">
            <span className="leading-tight">{t('share_gallery')}</span>
            <span className="text-[10px] text-slate-500 truncate">{t('share_photo_count', { count: photoCount })}</span>
          </div>
        </button>

        {/* Divider */}
        <div className="w-[1px] bg-slate-700 my-2"></div>

        {/* Camera Direct Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onTakePhoto) onTakePhoto();
          }}
          className="w-12 flex items-center justify-center hover:bg-slate-700 rounded-r-lg text-slate-400 hover:text-emerald-400 transition-colors group"
          title={t('share_camera_title')}
        >
          <Camera size={18} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>

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
            {t('share_set_bg')}
          </button>
        </>
      )}
    </div>
  );
};

export default ShareMenu;
