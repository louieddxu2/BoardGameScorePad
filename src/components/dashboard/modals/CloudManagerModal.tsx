
import React, { useState, useEffect } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { DownloadCloud, X, FolderOpen, Trash2, RefreshCw, UploadCloud, Download, FileJson, Clock, RefreshCcw, Activity, LayoutGrid, History, HardDriveUpload, Loader2, AlertTriangle, LogOut, Cloud } from 'lucide-react';
import { CloudFile, CloudResourceType } from '../../../services/googleDrive';
import ConfirmationModal from '../../shared/ConfirmationModal';
import { useToast } from '../../../hooks/useToast';

interface CloudManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'templates' | 'sessions' | 'history'; 
  isConnected: boolean; // [New]
  isMockMode: boolean;
  fetchFileList: (mode: 'active' | 'trash', source: 'templates' | 'sessions' | 'history') => Promise<CloudFile[]>;
  restoreBackup: (id: string) => Promise<GameTemplate>;
  restoreSessionBackup: (id: string) => Promise<GameSession>; 
  restoreHistoryBackup?: (id: string) => Promise<HistoryRecord>;
  restoreFromTrash: (id: string, type: CloudResourceType) => Promise<boolean>;
  deleteCloudFile: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<boolean>;
  connectToCloud: () => Promise<boolean>; // [New]
  disconnectFromCloud: () => Promise<void>; // [New]
  onRestoreSuccess: (template: GameTemplate) => void;
  onSessionRestoreSuccess: (session: GameSession) => void;
  onHistoryRestoreSuccess?: (record: HistoryRecord) => void;
  onSystemBackup?: (onProgress: (count: number, total: number) => void, onError: (failedItems: string[]) => void) => Promise<void>; 
}

const CloudManagerModal: React.FC<CloudManagerModalProps> = ({ 
  isOpen, onClose, initialCategory = 'templates',
  isConnected, isMockMode, 
  fetchFileList, restoreBackup, restoreSessionBackup, restoreHistoryBackup, restoreFromTrash, deleteCloudFile, emptyTrash,
  connectToCloud, disconnectFromCloud,
  onRestoreSuccess, onSessionRestoreSuccess, onHistoryRestoreSuccess, onSystemBackup
}) => {
  const [category, setCategory] = useState<'templates' | 'sessions' | 'history'>(initialCategory);
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<CloudFile | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const { showToast } = useToast();

  // Backup Process State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState({ count: 0, total: 0 });
  const [failedBackupItems, setFailedBackupItems] = useState<string[]>([]); // Track failures

  // Sync category with prop when modal opens
  useEffect(() => {
      if (isOpen) {
          setCategory(initialCategory);
          setViewMode('active'); // Reset view mode on open
          setFailedBackupItems([]); // Clear previous errors
      }
  }, [isOpen, initialCategory]);

  // Handle Back Button
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: 'cloud' }, '');
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        onClose();
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onClose]);

  const refreshList = async () => {
    if (!isConnected) return; // Don't fetch if not connected
    
    setIsLoading(true);
    if (cloudFiles.length > 0) setCloudFiles([]); 
    
    try {
      // Pass both category and view mode to fetch correct files
      const files = await fetchFileList(viewMode, category);
      setCloudFiles(files);
    } catch (e) {
        // Error handling done in hook
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger refresh when necessary
  useEffect(() => {
    if (isOpen && isConnected) refreshList();
  }, [isOpen, viewMode, category, isConnected]);

  const handleSwitchCategory = (cat: 'templates' | 'sessions' | 'history') => {
      if (cat === category) return;
      setCloudFiles([]);
      setCategory(cat);
      // Reset view mode to active when switching categories? Usually safer.
      setViewMode('active');
  };

  const handleSwitchMode = (mode: 'active' | 'trash') => {
      if (mode === viewMode) return;
      setCloudFiles([]);
      setViewMode(mode);
  };

  const handleFileSelect = async (file: CloudFile) => {
    if (viewMode === 'trash') return;
    setIsLoading(true);
    try {
      if (category === 'templates') {
          const templateWithExtra = await restoreBackup(file.id);
          const { _tempImageBase64, ...cleanTemplate } = templateWithExtra as any;
          onRestoreSuccess(cleanTemplate);
          if (_tempImageBase64) {
            showToast({ message: "模板已還原。注意：背景圖片需在開啟遊戲時重新設定或由雲端載入。", type: 'info' });
          }
      } else if (category === 'sessions') {
          // Restore Session
          const session = await restoreSessionBackup(file.id);
          onSessionRestoreSuccess(session);
      } else if (category === 'history' && restoreHistoryBackup && onHistoryRestoreSuccess) {
          // Restore History
          const record = await restoreHistoryBackup(file.id);
          onHistoryRestoreSuccess(record);
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileDelete = async () => {
    if (!fileToDelete) return;
    const success = await deleteCloudFile(fileToDelete.id);
    if (success) await refreshList();
    setFileToDelete(null);
  };

  const handleRestoreFromTrash = async (file: CloudFile) => {
    // Determine type based on current category tab
    let type: CloudResourceType = 'template';
    if (category === 'sessions') type = 'active';
    if (category === 'history') type = 'history';

    const success = await restoreFromTrash(file.id, type);
    if (success) await refreshList();
  };

  const handleEmptyTrash = async () => {
    const success = await emptyTrash();
    if (success) await refreshList();
    setShowEmptyTrashConfirm(false);
  };

  const handleSystemBackup = async () => {
      if (!onSystemBackup) return;
      setIsBackingUp(true);
      setBackupProgress({ count: 0, total: 0 });
      setFailedBackupItems([]);
      try {
          await onSystemBackup(
              (count, total) => setBackupProgress({ count, total }),
              (failed) => setFailedBackupItems(failed)
          );
          await refreshList();
      } catch (e) {
          console.error(e);
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleConnect = async () => {
      setIsLoading(true);
      await connectToCloud();
      setIsLoading(false);
  };

  const handleDisconnect = async () => {
      await disconnectFromCloud();
      setCloudFiles([]);
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
            if (e.target === e.currentTarget && !isBackingUp) onClose();
        }}
    >
      <ConfirmationModal isOpen={!!fileToDelete} title="永久刪除備份？" message={`確定要永久刪除「${fileToDelete?.name.replace(/_[a-zA-Z0-9]{6,}$/, '')}」嗎？此動作無法復原。`} confirmText="永久刪除" isDangerous={true} onCancel={() => setFileToDelete(null)} onConfirm={handleFileDelete} />
      <ConfirmationModal isOpen={showEmptyTrashConfirm} title="清空垃圾桶？" message="確定要永久刪除所有垃圾桶中的檔案嗎？此動作無法復原。" confirmText="確認清空" isDangerous={true} onCancel={() => setShowEmptyTrashConfirm(false)} onConfirm={handleEmptyTrash} />

      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
        <div className="flex-none bg-slate-800 rounded-t-2xl px-4 py-3 border-b border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><DownloadCloud size={20} className="text-sky-400" /> 雲端備份管理 {isMockMode && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">模擬</span>}</h3>
            <div className="flex items-center gap-2">
                {/* Disconnect Button (Only show if connected and not backing up) */}
                {isConnected && !isBackingUp && (
                    <button 
                        onClick={handleDisconnect}
                        className="p-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg text-red-400 transition-colors flex items-center gap-1"
                        title="登出 Google Drive"
                    >
                        <LogOut size={16} />
                        <span className="text-xs font-bold hidden sm:inline">登出</span>
                    </button>
                )}

                {/* System Backup Button */}
                {onSystemBackup && viewMode === 'active' && isConnected && (
                    <button 
                        onClick={handleSystemBackup}
                        disabled={isBackingUp}
                        className={`
                            bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg transition-all flex items-center gap-2 shadow-sm
                            ${isBackingUp ? 'cursor-not-allowed opacity-80 pl-3 pr-4' : ''}
                        `}
                        title="備份所有資料 (模板、紀錄、設定)"
                    >
                        {isBackingUp ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-xs font-mono font-bold">{backupProgress.count}/{backupProgress.total}</span>
                            </>
                        ) : (
                            <>
                                <HardDriveUpload size={16} />
                                <span className="text-xs font-bold hidden sm:inline">全域備份</span>
                            </>
                        )}
                    </button>
                )}
                {!isBackingUp && (
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
                )}
            </div>
          </div>
          
          {/* Category Toggle */}
          <div className="flex gap-2">
              <button 
                onClick={() => handleSwitchCategory('templates')}
                disabled={isBackingUp || !isConnected}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${category === 'templates' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'} ${isBackingUp || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                  <LayoutGrid size={14} /> 遊戲庫
              </button>
              <button 
                onClick={() => handleSwitchCategory('sessions')}
                disabled={isBackingUp || !isConnected}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${category === 'sessions' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'} ${isBackingUp || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                  <Activity size={14} /> 進行中
              </button>
              <button 
                onClick={() => handleSwitchCategory('history')}
                disabled={isBackingUp || !isConnected}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${category === 'history' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'} ${isBackingUp || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                  <History size={14} /> 歷史
              </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700/50">
            <button onClick={() => handleSwitchMode('active')} disabled={isBackingUp || !isConnected} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${viewMode === 'active' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'} ${isBackingUp || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><FolderOpen size={14} /> 雲端檔案</button>
            <button onClick={() => handleSwitchMode('trash')} disabled={isBackingUp || !isConnected} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${viewMode === 'trash' ? 'bg-red-900/50 text-red-200 shadow-sm border border-red-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'} ${isBackingUp || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><Trash2 size={14} /> 垃圾桶</button>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-slate-900 relative">
          
          {/* Main Content Area */}
          {!isConnected ? (
              // Offline State
              <div className="flex flex-col items-center justify-center h-full gap-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 relative">
                      <DownloadCloud size={48} className="text-slate-500 opacity-50" />
                      <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1.5 border-4 border-slate-900">
                          <X size={16} className="text-white" strokeWidth={3} />
                      </div>
                  </div>
                  <div className="text-center space-y-2">
                      <h4 className="text-lg font-bold text-white">尚未連線</h4>
                      <p className="text-sm text-slate-400 max-w-[200px]">請登入 Google Drive 以存取您的雲端備份。</p>
                  </div>
                  <button 
                      onClick={handleConnect} 
                      disabled={isLoading}
                      className="w-full max-w-[200px] py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                      {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}
                      <span>立即連線</span>
                  </button>
              </div>
          ) : (
              // Connected State
              <>
                {/* Failed Items Warning Overlay (Shown at top of list) */}
                {failedBackupItems.length > 0 && (
                    <div className="mb-4 bg-red-900/20 border border-red-500/50 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-sm">
                            <AlertTriangle size={16} />
                            備份部分失敗 ({failedBackupItems.length})
                        </div>
                        <div className="text-xs text-red-300/80 max-h-32 overflow-y-auto pl-6 list-disc">
                            {failedBackupItems.map((item, idx) => (
                                <div key={idx} className="truncate">• {item}</div>
                            ))}
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500"><RefreshCw size={24} className="animate-spin" /><span className="text-xs">讀取中...</span></div>
                ) : cloudFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">{viewMode === 'trash' ? <Trash2 size={32} className="opacity-50" /> : <UploadCloud size={32} className="opacity-50" />}<span className="text-sm">{viewMode === 'trash' ? "垃圾桶是空的" : "雲端沒有找到備份檔案"}</span></div>
                ) : (
                    <div className={`space-y-2 ${isBackingUp ? 'pointer-events-none opacity-50' : ''}`}>
                    {cloudFiles.map(file => (
                        <div key={file.id} onClick={() => viewMode === 'active' ? handleFileSelect(file) : null} className={`w-full bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center justify-between group transition-all ${viewMode === 'active' ? 'cursor-pointer hover:bg-slate-700 hover:border-sky-500/50' : 'cursor-default opacity-80 hover:opacity-100'}`}>
                        <div className="flex items-start gap-3 text-left flex-1 min-w-0">
                            <div className={`p-2 bg-slate-900 rounded-lg shrink-0 ${viewMode === 'active' ? 'text-sky-500' : 'text-red-400'}`}><FileJson size={20} /></div>
                            <div className="min-w-0"><div className="font-bold text-slate-200 group-hover:text-white transition-colors truncate">{file.name.replace(/_[a-zA-Z0-9]{6,}$/, '')}</div><div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Clock size={10} /> {new Date(file.createdTime).toLocaleString()}</div></div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {viewMode === 'active' ? (
                                <>
                                    <Download size={18} className="text-slate-600 group-hover:text-sky-400 transition-colors mr-2" />
                                    <button onClick={(e) => { e.stopPropagation(); setFileToDelete(file); }} className="p-2 -m-2 text-slate-600 hover:text-red-400 hover:bg-slate-900/50 rounded-lg transition-colors z-10" title="移至垃圾桶"><Trash2 size={18} /></button>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleRestoreFromTrash(file); }} className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-emerald-900/30 border border-slate-700 rounded-lg transition-colors" title="還原"><RefreshCcw size={16} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setFileToDelete(file); }} className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-900 hover:bg-red-900/30 border border-slate-700 rounded-lg transition-colors" title="永久刪除"><Trash2 size={16} /></button>
                                </div>
                            )}
                        </div>
                        </div>
                    ))}
                    </div>
                )}
              </>
          )}
        </div>
        {viewMode === 'trash' && cloudFiles.length > 0 && isConnected && (<div className="flex-none p-3 bg-slate-800 border-t border-slate-700"><button onClick={() => setShowEmptyTrashConfirm(true)} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"><Trash2 size={16} /> 清空垃圾桶</button></div>)}
      </div>
    </div>
  );
};

export default CloudManagerModal;
