
import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Loader2, Database, AlertTriangle, ArrowRight, Globe, Clock, DownloadCloud } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { bggImportService } from '../services/bggImportService';
import { ImportAnalysisReport, ImportManualLinks } from '../../bgstats/types';
import ImportStagingView from '../../bgstats/components/ImportStagingView';

interface BggImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportState = 'file_selection' | 'analyzing' | 'staging' | 'importing';

// [Config] 預設的 Google Sheet 連結 (作為初始值或 fallback)
const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1L_RGm03e07gZc8Di12Tnwk5hbd0BYKvyOng3WY4r3Zs/edit?usp=sharing";
const URL_STORAGE_KEY = 'bgg_import_target_url';
const COOLDOWN_KEY = 'bgg_url_import_last_success';
const COOLDOWN_MINUTES = 5; // [Changed] Shortened to 5 minutes

const BggImportModal: React.FC<BggImportModalProps> = ({ isOpen, onClose }) => {
  const [importState, setImportState] = useState<ImportState>('file_selection');
  const [analysisReport, setAnalysisReport] = useState<ImportAnalysisReport | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null);
  
  // Track import source to decide whether to trigger cooldown on success
  const [isUrlSource, setIsUrlSource] = useState(false);
  
  // URL State with persistence
  const [targetUrl, setTargetUrl] = useState(() => {
      return localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_SHEET_URL;
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
      if (!isOpen) {
          setImportState('file_selection');
          setAnalysisReport(null);
          setIsUrlSource(false);
      } else {
          checkCooldown();
      }
  }, [isOpen]);

  // Save URL on change
  useEffect(() => {
      localStorage.setItem(URL_STORAGE_KEY, targetUrl);
  }, [targetUrl]);

  // 檢查冷卻時間
  const checkCooldown = () => {
      const lastSuccessStr = localStorage.getItem(COOLDOWN_KEY);
      if (lastSuccessStr) {
          const lastSuccess = parseInt(lastSuccessStr, 10);
          const now = Date.now();
          const diffMs = now - lastSuccess;
          const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

          if (diffMs < cooldownMs) {
              const remainingMs = cooldownMs - diffMs;
              const remainingMins = Math.ceil(remainingMs / (60 * 1000));
              setCooldownRemaining(`${remainingMins}m`);
          } else {
              setCooldownRemaining(null);
          }
      } else {
          setCooldownRemaining(null);
      }
  };

  // [Fix] 必須檢查 isOpen，否則會導致 Modal 一直覆蓋在畫面上
  if (!isOpen) return null;

  // 輔助函式：偵測並解碼 ArrayBuffer
  const decodeCSVBuffer = (buffer: ArrayBuffer): string => {
      try {
          // 1. 嘗試以嚴格的 UTF-8 解碼 (fatal: true 會在遇到非 UTF-8 字元時拋錯)
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          return utf8Decoder.decode(buffer);
      } catch (e) {
          // 2. 若失敗，通常是 Windows Excel 的 Big5 編碼
          console.log("[BGG Import] UTF-8 decoding failed, falling back to Big5");
          try {
              const big5Decoder = new TextDecoder('big5');
              return big5Decoder.decode(buffer);
          } catch (e2) {
              // 3. 若 Big5 也失敗，回退到寬鬆 UTF-8
              console.warn("[BGG Import] Big5 decoding failed, falling back to loose UTF-8");
              return new TextDecoder('utf-8').decode(buffer);
          }
      }
  };

  // 智能網址轉換器：將 Google Sheet 的檢視網址轉為 CSV 匯出網址
  const convertGoogleSheetUrl = (url: string): string => {
      // 檢查是否為 Google Sheets 網址
      if (url.includes('docs.google.com/spreadsheets')) {
          // 提取 ID
          const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (matches && matches[1]) {
              const id = matches[1];
              // 回傳標準匯出格式
              return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
          }
      }
      return url; // 如果不是 Google Sheet 或無法解析，回傳原網址
  };

  const handleUrlImport = async () => {
      if (cooldownRemaining) {
          showToast({ message: `請稍後再試，資料庫更新冷卻中。`, type: 'info' });
          return;
      }
      
      if (!targetUrl.trim()) {
          showToast({ message: "請輸入有效的網址", type: 'warning' });
          return;
      }

      setImportState('analyzing');
      setIsUrlSource(true); // Mark as URL source

      try {
          // 1. Convert URL to CSV format if needed
          const finalUrl = convertGoogleSheetUrl(targetUrl);
          console.log("[BGG Import] Fetching from:", finalUrl);

          // 2. Fetch CSV
          const response = await fetch(finalUrl);
          
          if (!response.ok) {
              throw new Error(`Network response was not ok: ${response.status}`);
          }

          // 3. Get ArrayBuffer and Decode (Using existing robust logic)
          const buffer = await response.arrayBuffer();
          const text = decodeCSVBuffer(buffer);

          // 4. Analyze
          const report = await bggImportService.analyzeData(text);
          setAnalysisReport(report);
          setImportState('staging');
          
          // [Updated] Do NOT set cooldown here. Wait for confirm.

      } catch (e: any) {
          console.error("URL Import Failed", e);
          const msg = e.message || "下載失敗";
          showToast({ message: `連線失敗：${msg}`, type: 'error' });
          setImportState('file_selection');
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImportState('analyzing');
      setIsUrlSource(false); // Mark as File source

      const reader = new FileReader();
      
      reader.onload = async (ev) => {
          try {
              const buffer = ev.target?.result as ArrayBuffer;
              // 使用自定義解碼邏輯處理原始數據
              const text = decodeCSVBuffer(buffer);
              
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
      
      // 關鍵：改用 ArrayBuffer 讀取，以保留原始 Byte 供解碼判斷
      reader.readAsArrayBuffer(file);
  };

  const handleStagingConfirm = async (links: ImportManualLinks) => {
      if (!analysisReport) return;
      
      setImportState('importing');
      try {
          // 2. 執行匯入
          const count = await bggImportService.importData(analysisReport.sourceData, links);
          showToast({ message: `成功更新 ${count} 個現有遊戲，並擴充 BGG 字典`, type: 'success' });
          
          // [Updated] Set cooldown ONLY if it was a URL import and it succeeded
          if (isUrlSource) {
              localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
              checkCooldown(); 
          }

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

  // Default Modal Layout for other states
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
                     {importState === 'analyzing' ? '正在下載與分析...' : '正在更新資料庫...'}
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

                    <div className="flex flex-col gap-3">
                        {/* URL Import Input Group */}
                        <div className="flex flex-col gap-1">
                            <div className="text-xs font-bold text-slate-400 pl-1 uppercase">從雲端匯入</div>
                            <div className="bg-slate-900 rounded-xl border border-slate-700 p-1 flex items-center gap-1 shadow-sm focus-within:ring-1 focus-within:ring-sky-500 focus-within:border-sky-500 transition-all">
                                <div className="pl-2 text-slate-500 shrink-0">
                                    <Globe size={16} />
                                </div>
                                <input 
                                    type="text"
                                    value={targetUrl}
                                    onChange={(e) => setTargetUrl(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="輸入 CSV 或 Google Sheet 網址"
                                    className="flex-1 bg-transparent border-none outline-none text-xs text-slate-200 py-3 font-mono min-w-0"
                                />
                                <button
                                    onClick={handleUrlImport}
                                    disabled={!!cooldownRemaining}
                                    className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shrink-0 whitespace-nowrap
                                        ${cooldownRemaining 
                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                                            : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/50'
                                        }
                                    `}
                                >
                                    {cooldownRemaining ? <Clock size={14} /> : <DownloadCloud size={14} />}
                                    {cooldownRemaining ? cooldownRemaining : '更新'}
                                </button>
                            </div>
                            <div className="text-[10px] text-slate-500 pl-1">
                                {cooldownRemaining 
                                    ? `資料庫冷卻中，請於 ${cooldownRemaining} 後再試` 
                                    : "支援 Google Sheet 分享連結 (5分鐘/次)"
                                }
                            </div>
                        </div>

                        <div className="relative py-1">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">或</span></div>
                        </div>

                        {/* File Import Button */}
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-600 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 group"
                        >
                            <div className="flex items-center gap-2">
                                <Upload size={18} className="group-hover:scale-110 transition-transform" />
                                <span>選擇 CSV 檔案</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-normal">手動上傳您的 BGG 匯出檔</span>
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
                        支援從 BGG 網站匯出的標準 CSV 格式 (支援 Big5/UTF-8)
                    </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default BggImportModal;
