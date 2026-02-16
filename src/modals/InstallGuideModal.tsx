import React from 'react';
import { X, Share, MoreVertical, PlusSquare, Download, Smartphone } from 'lucide-react';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Download size={20} className="text-emerald-500" />
            安裝到主畫面
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[70vh]">
          
          <p className="text-sm text-slate-400 leading-relaxed">
            將此網頁安裝為 App，可獲得最佳的全螢幕體驗與離線功能。請依照您的裝置類型操作：
          </p>

          {/* iOS Section */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
            <h4 className="text-white font-bold flex items-center gap-2 border-b border-slate-700/50 pb-2">
              <span className="bg-white/10 p-1 rounded text-slate-300"><Smartphone size={16} /></span>
              iOS (iPhone/iPad)
            </h4>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="flex-none bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                <span>
                  點擊瀏覽器底部的 <span className="inline-flex items-center gap-1 bg-slate-700 px-1.5 py-0.5 rounded text-sky-400 mx-1"><Share size={12} /> 分享</span> 按鈕。
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                <span>
                  在選單中往下滑，找到並點擊 <span className="inline-flex items-center gap-1 bg-slate-700 px-1.5 py-0.5 rounded text-white mx-1"><PlusSquare size={12} /> 加入主畫面</span>。
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none bg-indigo-500/20 text-indigo-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                <span>點擊右上角的「加入」即可完成。</span>
              </li>
            </ol>
          </div>

          {/* Android Section */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
            <h4 className="text-white font-bold flex items-center gap-2 border-b border-slate-700/50 pb-2">
              <span className="bg-white/10 p-1 rounded text-slate-300"><Smartphone size={16} /></span>
              Android (Chrome)
            </h4>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="flex-none bg-emerald-500/20 text-emerald-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                <span>
                  點擊瀏覽器右上角的 <span className="inline-flex items-center gap-1 bg-slate-700 px-1.5 py-0.5 rounded text-white mx-1"><MoreVertical size={12} /> 選單</span> 圖示。
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none bg-emerald-500/20 text-emerald-400 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                <span>
                  選擇 <span className="font-bold text-white">「安裝應用程式」</span> 或 <span className="font-bold text-white">「加到主畫面」</span>。
                </span>
              </li>
            </ol>
          </div>

        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700">
            <button onClick={onClose} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors">
                我瞭解了
            </button>
        </div>
      </div>
    </div>
  );
};

export default InstallGuideModal;