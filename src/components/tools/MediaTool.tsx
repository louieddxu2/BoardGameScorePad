
import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface MediaToolProps {
  onTakePhoto?: () => void;
  onScreenshot?: () => void;
}

const MediaTool: React.FC<MediaToolProps> = ({ onTakePhoto, onScreenshot }) => {
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
        <button 
            onClick={onTakePhoto}
            className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all active:scale-95 text-slate-300 h-24"
        >
            <div className="p-2 bg-sky-500/10 rounded-full mb-1 text-sky-400">
                <Camera size={24} />
            </div>
            <span className="text-xs font-bold">拍照</span>
        </button>
        <button 
            onClick={onScreenshot}
            className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all active:scale-95 text-slate-300 h-24"
        >
            <div className="p-2 bg-emerald-500/10 rounded-full mb-1 text-emerald-400">
                <ImageIcon size={24} />
            </div>
            <span className="text-xs font-bold">截圖</span>
        </button>
    </div>
  );
};

export default MediaTool;
