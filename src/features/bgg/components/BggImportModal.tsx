
import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Loader2, Database, AlertTriangle, ArrowRight } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { bggImportService } from '../services/bggImportService';
import { ImportAnalysisReport, ImportManualLinks } from '../../bgstats/types';
import ImportStagingView from '../../bgstats/components/ImportStagingView';

interface BggImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportState = 'file_selection' | 'analyzing' | 'staging' | 'importing';

const BggImportModal: React.FC<BggImportModalProps> = ({ isOpen, onClose }) => {
  const [importState, setImportState] = useState<ImportState>('file_selection');
  const [analysisReport, setAnalysisReport] = useState<ImportAnalysisReport | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
      if (!isOpen) {
          setImportState('file_selection');
          setAnalysisReport(null);
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImportState('analyzing');
      const reader = new FileReader();
      
      reader.onload = async (ev) => {
          try {
              const text = ev.target?.result as string;
              // 1. 分析 CSV 並產生報告
              const report = await bggImportService.analyzeData(text);
              setAnalysisReport(report);
              setImportState('staging');
          } catch (e) {
              console.error(e);
              showToast({ message: "BGG 匯入失敗，請確認 CSV 格式", type: 'error' });
              setImportState('file_selection');
          } finally {
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleStagingConfirm = async (links: ImportManualLinks) => {
      if (!analysisReport) return;
      
      setImportState('importing');
      try {
          // 2. 執行匯入
          const count = await bggImportService.importData(analysisReport.sourceData, links);
          showToast({ message: `成功更新 ${count} 個現有遊戲，並擴充 BGG 字典`, type: 'success' });
          onClose();
      } catch (e) {
          console.error(e);
          showToast({ message: "匯入過程發生錯誤", type: 'error' });
          setImportState('staging');
      }
  };

  // Full-screen Staging View
  if (importState === 'staging' && analysisReport) {
      return (
          <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col animate-in fade-in duration-200">
              <ImportStagingView 
                  report={analysisReport} 
                  onConfirm={handleStagingConfirm}
                  onCancel={() => setImportState('file_selection')}
                  isProcessing={false}
              />
          </div>
      );
  }

  // Default Modal Layout
  return (
    <div 
        className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={(e) => {
            if (e.target === e.currentTarget && importState !== 'importing') onClose();
        }}
    >
      <div 
        className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {importState === 'importing' || importState === 'analyzing' ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
                 <Loader2 size={48} className="animate-spin text-emerald-500" />
                 <span className="text-white font-bold">
                     {importState === 'analyzing' ? '正在分析 CSV...' : '正在更新資料庫...'}
                 </span>
                 <span className="text-xs text-slate-500">資料量較大時可能需要一點時間</span>
             </div>
        ) : (
            <>
                <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between flex-none">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database size={20} className="text-indigo-400" />
                        BGG 字典匯入
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 text-sm text-indigo-200 leading-relaxed">
                        <p className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                            匯入 BoardGameGeek Collection CSV 以建立搜尋字典。
                        </p>
                        <p className="mt-2 text-xs text-indigo-300/70">
                            這將豐富搜尋建議與遊戲資料（如人數、重度）。系統會自動嘗試將 BGG 資料連結到您的「我的遊戲庫」。
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                        >
                            <Upload size={24} className="group-hover:scale-110 transition-transform" />
                            <span>選擇 CSV 檔案</span>
                        </button>

                        <input 
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 border-t border-slate-800 text-center flex-none">
                    <p className="text-[10px] text-slate-500">
                        支援從 BGG 網站匯出的標準 CSV 格式
                    </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default BggImportModal;
