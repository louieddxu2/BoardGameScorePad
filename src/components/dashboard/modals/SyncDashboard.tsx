
import React, { useState } from 'react';
import { UploadCloud, DownloadCloud, AlertTriangle, CheckCircle, XCircle, ArrowRight, Loader2, Database, LayoutGrid, History, Activity } from 'lucide-react';

interface SyncDashboardProps {
  onClose: () => void;
  onUpload: () => void;
  onDownload: () => void;
  isSyncing: boolean;
  isScanning?: boolean; // New Prop
  syncStatus: 'idle' | 'scanning' | 'processing' | 'done';
  syncResult: {
    success: number;
    skipped: number;
    failed: string[];
    errors: string[];
    total: number;
    current: number;
    currentItem?: string;
    type: 'upload' | 'download' | null;
  };
  scanStats?: {
      upload: { templates: number; sessions: number; history: number };
      download: { templates: number; sessions: number; history: number };
  };
}

const SyncDashboard: React.FC<SyncDashboardProps> = ({ 
  onClose, 
  onUpload, 
  onDownload, 
  isSyncing, 
  isScanning,
  syncStatus, 
  syncResult,
  scanStats
}) => {
  const [confirmMode, setConfirmMode] = useState<'upload' | 'download' | null>(null);

  // --- Render Logic ---

  if (syncStatus === 'processing') {
    return (
      <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse"></div>
            <Loader2 size={64} className="text-emerald-500 animate-spin relative z-10" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
            {syncResult.type === 'upload' ? '正在備份至雲端...' : '正在從雲端還原...'}
        </h3>
        <p className="text-slate-400 text-sm font-mono mb-4">
            {syncResult.current} / {syncResult.total}
        </p>
        <div className="w-full max-w-xs h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mb-2">
            <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${syncResult.total > 0 ? (syncResult.current / syncResult.total) * 100 : 0}%` }}
            />
        </div>
        <p className="text-xs text-slate-500 h-4 truncate max-w-xs text-center">
            {syncResult.currentItem || '準備中...'}
        </p>
      </div>
    );
  }

  if (syncStatus === 'done') {
    return (
      <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in zoom-in-95 duration-300">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl ${syncResult.errors.length > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                {syncResult.errors.length > 0 ? <AlertTriangle size={40} /> : <CheckCircle size={40} />}
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-6">
                {syncResult.type === 'upload' ? '備份完成' : '還原完成'}
            </h3>

            <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8">
                <div className="bg-slate-800 p-4 rounded-xl text-center border border-slate-700">
                    <div className="text-2xl font-black text-emerald-400">{syncResult.success}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase mt-1">成功</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl text-center border border-slate-700">
                    <div className="text-2xl font-black text-sky-400">{syncResult.skipped}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase mt-1">略過 (最新)</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl text-center border border-slate-700">
                    <div className={`text-2xl font-black ${syncResult.failed.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>{syncResult.failed.length}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase mt-1">失敗</div>
                </div>
            </div>

            {syncResult.errors.length > 0 && (
                <div className="w-full max-w-sm bg-red-900/10 border border-red-500/30 rounded-xl p-4 mb-4">
                    <h4 className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2"><XCircle size={14}/> 錯誤詳情</h4>
                    <div className="text-xs text-red-300/80 space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                        {syncResult.errors.map((err, i) => <div key={i}>• {err}</div>)}
                    </div>
                </div>
            )}
            
            <div className="flex-1"></div>
            
            <button onClick={onClose} className="w-full max-w-sm py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors border border-slate-600">
                關閉並重整列表
            </button>
        </div>
      </div>
    );
  }

  // --- Stats Block Helper ---
  const renderStats = (type: 'upload' | 'download') => {
      if (!scanStats || isScanning) return <div className="h-10 flex items-center justify-center text-slate-500 text-xs gap-2"><Loader2 size={12} className="animate-spin" /> 分析中...</div>;
      
      const data = type === 'upload' ? scanStats.upload : scanStats.download;
      const total = data.templates + data.sessions + data.history;
      const hasData = total > 0;
      
      return (
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className={`p-2 rounded-lg border ${hasData ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                  <div className={`text-sm font-bold ${hasData ? 'text-white' : 'text-slate-500'}`}>{data.templates}</div>
                  <div className="text-[9px] text-slate-500 uppercase flex justify-center items-center gap-1"><LayoutGrid size={8} /> 遊戲</div>
              </div>
              <div className={`p-2 rounded-lg border ${hasData ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                  <div className={`text-sm font-bold ${hasData ? 'text-white' : 'text-slate-500'}`}>{data.sessions}</div>
                  <div className="text-[9px] text-slate-500 uppercase flex justify-center items-center gap-1"><Activity size={8} /> 進行中</div>
              </div>
              <div className={`p-2 rounded-lg border ${hasData ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                  <div className={`text-sm font-bold ${hasData ? 'text-white' : 'text-slate-500'}`}>{data.history}</div>
                  <div className="text-[9px] text-slate-500 uppercase flex justify-center items-center gap-1"><History size={8} /> 歷史</div>
              </div>
          </div>
      );
  };

  // --- Main Action Selection UI ---

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/95 flex flex-col animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex-none p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database size={20} className="text-indigo-400" />
                資料同步中心
            </h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors">
                <ArrowRight size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Upload Section */}
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${confirmMode === 'upload' ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                <div 
                    className="p-5 flex items-center gap-4 cursor-pointer"
                    onClick={() => setConfirmMode(confirmMode === 'upload' ? null : 'upload')}
                >
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <UploadCloud size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-white">備份至雲端 (Upload)</h3>
                        <p className="text-xs text-slate-400 mt-1">將本機的資料上傳至 Google Drive。</p>
                        {renderStats('upload')}
                    </div>
                </div>
                
                {confirmMode === 'upload' && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-slate-950/50 rounded-xl p-3 text-xs text-slate-400 mb-4 space-y-2 border border-slate-800">
                            <p className="flex items-center gap-2"><span className="text-emerald-400">●</span> 若雲端已有較新版本，將自動略過。</p>
                            <p className="flex items-center gap-2"><span className="text-emerald-400">●</span> 包含遊戲庫、歷史紀錄與進行中遊戲。</p>
                        </div>
                        <button 
                            onClick={onUpload}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-900/50 transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <UploadCloud size={18} /> 開始上傳
                        </button>
                    </div>
                )}
            </div>

            {/* Download Section */}
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${confirmMode === 'download' ? 'bg-slate-800 border-sky-500 ring-2 ring-sky-500/20' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                <div 
                    className="p-5 flex items-center gap-4 cursor-pointer"
                    onClick={() => setConfirmMode(confirmMode === 'download' ? null : 'download')}
                >
                    <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
                        <DownloadCloud size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-white">從雲端還原 (Download)</h3>
                        <p className="text-xs text-slate-400 mt-1">將 Google Drive 的資料下載至本機。</p>
                        {renderStats('download')}
                    </div>
                </div>
                
                {confirmMode === 'download' && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-amber-900/10 rounded-xl p-3 text-xs text-amber-200/80 mb-4 space-y-2 border border-amber-500/20">
                            <p className="font-bold flex items-center gap-2"><AlertTriangle size={12}/> 注意事項</p>
                            <p>此動作將會把雲端資料寫入本機。</p>
                            <p className="text-slate-400">系統將自動比對修改時間，若本機資料較新則會保留（略過下載），避免覆蓋您尚未備份的進度。</p>
                        </div>
                        <button 
                            onClick={onDownload}
                            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-900/50 transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <DownloadCloud size={18} /> 開始下載
                        </button>
                    </div>
                )}
            </div>

        </div>
    </div>
  );
};

export default SyncDashboard;
