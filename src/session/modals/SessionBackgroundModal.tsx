
import React from 'react';
import { X, ScanLine, DownloadCloud, Aperture, Upload, Trash2 } from 'lucide-react';

interface SessionBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasCloudImage: boolean;
  isConnected: boolean;
  onCloudDownload: () => void;
  onScannerCamera: () => void;
  onUploadClick: () => void; // Trigger hidden input
  onRemoveBackground: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SessionBackgroundModal: React.FC<SessionBackgroundModalProps> = ({
  isOpen,
  onClose,
  hasCloudImage,
  isConnected,
  onCloudDownload,
  onScannerCamera,
  onUploadClick,
  onRemoveBackground,
  fileInputRef,
  onFileChange
}) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
        onClick={onClose}
    >
        <div 
            className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
            onClick={(e) => e.stopPropagation()} 
        >
            <button 
                onClick={onClose}
                className="absolute top-2 right-2 text-slate-500 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
            >
                <X size={20} />
            </button>

            <div className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                <ScanLine size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">設定計分紙背景</h3>
            <p className="text-sm text-slate-400">
                此模板已包含框線設定。
                {hasCloudImage ? "您可以從雲端還原背景，或重新拍攝。" : "請拍攝或上傳計分紙照片。"}
            </p>
            
            {hasCloudImage && (
                <button 
                    onClick={onCloudDownload} 
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2"
                >
                    <DownloadCloud size={20} /> 
                    {isConnected ? "從雲端下載" : "連線並下載"}
                </button>
            )}

            <button onClick={onScannerCamera} className={`w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${hasCloudImage ? 'mt-1' : 'mt-2'}`}>
                <Aperture size={20} /> 拍攝新照片
            </button>

            <button onClick={onUploadClick} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2">
                <Upload size={20} /> 從相簿上傳
            </button>
            {/* The actual input remains here but controlled via ref from parent or local handle */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            
            <button onClick={onRemoveBackground} className="flex items-center gap-2 text-slate-500 text-xs hover:text-red-400 mt-4 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                <Trash2 size={14} /> 移除計分紙返回標準介面
            </button>
        </div>
    </div>
  );
};

export default SessionBackgroundModal;
