
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
      if (!scanStats || isScanning) return <div className="h-24 flex items-center justify-center text-slate-500 text-xs gap-2 bg-slate-950/30 rounded-xl border border-slate-800/50 mt-4"><Loader2 size={16} className="animate-spin" /> 分析資料中...</div>;
      
      const data = type === 'upload' ? scanStats.upload : scanStats.download;
      const includeSessions = type === 'upload';
      const total = data.templates + (includeSessions ? data.sessions : 0) + data.history;
      const hasData = total > 0;
      
      const boxClass = `p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${hasData ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-60'}`;
      const numberClass = `text-2xl font-black ${hasData ? 'text-white' : 'text-slate-600'}`;
      const labelClass = "text-xs text-slate-500 uppercase flex justify-center items-center gap-1.5 font-bold";

      return (
          <div className="grid grid-cols-3 gap-3 mt-4">
              <div className={boxClass}>
                  <div className={numberClass}>{data.templates}</div>
                  <div className={labelClass}><LayoutGrid size={12} /> 遊戲</div>
              </div>
              
              {/* Only show session count for Upload */}
              {includeSessions ? (
                  <div className={boxClass}>
                      <div className={numberClass}>{data.sessions}</div>
                      <div className={labelClass}><Activity size={12} /> 進行中</div>
                  </div>
              ) : (
                  // For Download, show a placeholder or empty
                  <div className="p-3 rounded-xl border bg-slate-900 border-slate-800 opacity-40 flex flex-col items-center justify-center gap-1">
                      <div className="text-2xl font-black text-slate-700">-</div>
                      <div className="text-xs text-slate-600 uppercase flex justify-center items-center gap-1.5 font-bold"><Activity size={12} /> 進行中</div>
                  </div>
              )}

              <div className={boxClass}>
                  <div className={numberClass}>{data.history}</div>
                  <div className={labelClass}><History size={12} /> 歷史</div>
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
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${confirmMode === 'upload' ? 'bg-slate-800/50 border-indigo-500 ring-1 ring-indigo-500/20' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                <div 
                    className="p-5 cursor-pointer flex flex-col"
                    onClick={() => setConfirmMode(confirmMode === 'upload' ? null : 'upload')}
                >
                    {/* Header Row */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 border border-indigo-500/20">
                            <UploadCloud size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">備份至雲端</h3>
                            <p className="text-xs text-slate-400">將本機的資料上傳至 Google Drive</p>
                        </div>
                    </div>

                    {/* Stats Row (Full Width) */}
                    {renderStats('upload')}
                </div>
                
                {confirmMode === 'upload' && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200 border-t border-slate-700/50 pt-4 mt-2">
                        <div className="bg-slate-950/50 rounded-xl p-3 text-xs text-slate-400 mb-4 space-y-2 border border-slate-800">
                            <div className="flex items-start gap-2">
                                <span className="text-emerald-400 shrink-0 mt-0.5">●</span>
                                <span>雲端僅保留最新的 <strong className="text-white">20</strong> 筆進行中遊戲，舊檔將自動刪除。</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-emerald-400 shrink-0 mt-0.5">●</span>
                                <span>若雲端已有較新版本，將自動略過。</span>
                            </div>
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
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${confirmMode === 'download' ? 'bg-slate-800/50 border-sky-500 ring-1 ring-sky-500/20' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                <div 
                    className="p-5 cursor-pointer flex flex-col"
                    onClick={() => setConfirmMode(confirmMode === 'download' ? null : 'download')}
                >
                    {/* Header Row */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 border border-sky-500/20">
                            <DownloadCloud size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">從雲端還原</h3>
                            <p className="text-xs text-slate-400">將 Google Drive 的資料下載至本機</p>
                        </div>
                    </div>

                    {/* Stats Row (Full Width) */}
                    {renderStats('download')}
                </div>
                
                {confirmMode === 'download' && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200 border-t border-slate-700/50 pt-4 mt-2">
                        <div className="bg-amber-900/10 rounded-xl p-3 text-xs text-amber-200/80 mb-4 space-y-2 border border-amber-500/20">
                            <p className="font-bold flex items-center gap-2"><AlertTriangle size={12}/> 注意事項</p>
                            <p>此動作將會把雲端資料寫入本機。</p>
                            <p><strong className="text-white">不包含進行中遊戲</strong>（若需取回暫存檔，請至「雲端備份管理」手動下載）。</p>
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
