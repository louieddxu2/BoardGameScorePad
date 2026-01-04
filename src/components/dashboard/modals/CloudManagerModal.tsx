
import React, { useState, useEffect } from 'react';
import { GameTemplate } from '../../../types';
import { DownloadCloud, X, FolderOpen, Trash2, RefreshCw, UploadCloud, Download, FileJson, Clock, RefreshCcw } from 'lucide-react';
import { CloudFile } from '../../../services/googleDrive';
import ConfirmationModal from '../../shared/ConfirmationModal';
import { useToast } from '../../../hooks/useToast';

interface CloudManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Hooks / Actions injected from parent
  isMockMode: boolean;
  fetchFileList: (mode: 'active' | 'trash') => Promise<CloudFile[]>;
  restoreBackup: (id: string) => Promise<GameTemplate>;
  restoreFromTrash: (id: string) => Promise<boolean>;
  deleteCloudFile: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<boolean>;
  onRestoreSuccess: (template: GameTemplate) => void; // Callback to save template locally
}

const CloudManagerModal: React.FC<CloudManagerModalProps> = ({ 
  isOpen, onClose, 
  isMockMode, 
  fetchFileList, restoreBackup, restoreFromTrash, deleteCloudFile, emptyTrash,
  onRestoreSuccess 
}) => {
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<CloudFile | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const { showToast } = useToast();

  const refreshList = async () => {
    setIsLoading(true);
    setCloudFiles([]);
    try {
      const files = await fetchFileList(viewMode);
      setCloudFiles(files);
    } catch (e) {
        // Error handling is mostly done in useGoogleDrive, but we stop loading here
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen, viewMode]);

  const handleFileSelect = async (file: CloudFile) => {
    if (viewMode === 'trash') return;
    setIsLoading(true);
    try {
      const templateWithExtra = await restoreBackup(file.id);
      const { _tempImageBase64, ...cleanTemplate } = templateWithExtra as any;
      
      // Notify parent to save to local state
      onRestoreSuccess(cleanTemplate);

      if (_tempImageBase64) {
        showToast({ message: "模板已還原。注意：背景圖片需在開啟遊戲時重新設定或由雲端載入。", type: 'info' });
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
    const success = await restoreFromTrash(file.id);
    if (success) await refreshList();
  };

  const handleEmptyTrash = async () => {
    const success = await emptyTrash();
    if (success) await refreshList();
    setShowEmptyTrashConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <ConfirmationModal isOpen={!!fileToDelete} title="永久刪除備份？" message={`確定要永久刪除「${fileToDelete?.name.replace(/_[a-zA-Z0-9]{6,}$/, '')}」嗎？此動作無法復原。`} confirmText="永久刪除" isDangerous={true} onCancel={() => setFileToDelete(null)} onConfirm={handleFileDelete} />
      <ConfirmationModal isOpen={showEmptyTrashConfirm} title="清空垃圾桶？" message="確定要永久刪除垃圾桶中的所有檔案嗎？此動作無法復原。" confirmText="確認清空" isDangerous={true} onCancel={() => setShowEmptyTrashConfirm(false)} onConfirm={handleEmptyTrash} />

      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
        <div className="flex-none bg-slate-800 rounded-t-2xl px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><DownloadCloud size={20} className="text-sky-400" /> 雲端備份管理 {isMockMode && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">模擬</span>}</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
          </div>
          <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
            <button onClick={() => setViewMode('active')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${viewMode === 'active' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><FolderOpen size={14} /> 我的備份</button>
            <button onClick={() => setViewMode('trash')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${viewMode === 'trash' ? 'bg-red-900/50 text-red-200 shadow-sm border border-red-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><Trash2 size={14} /> 垃圾桶</button>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-slate-900">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500"><RefreshCw size={24} className="animate-spin" /><span className="text-xs">讀取中...</span></div>
          ) : cloudFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">{viewMode === 'trash' ? <Trash2 size={32} className="opacity-50" /> : <UploadCloud size={32} className="opacity-50" />}<span className="text-sm">{viewMode === 'trash' ? "垃圾桶是空的" : "雲端沒有找到備份檔案"}</span></div>
          ) : (
            <div className="space-y-2">
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
        </div>
        {viewMode === 'trash' && cloudFiles.length > 0 && (<div className="flex-none p-3 bg-slate-800 border-t border-slate-700"><button onClick={() => setShowEmptyTrashConfirm(true)} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"><Trash2 size={16} /> 清空垃圾桶</button></div>)}
      </div>
    </div>
  );
};

export default CloudManagerModal;
