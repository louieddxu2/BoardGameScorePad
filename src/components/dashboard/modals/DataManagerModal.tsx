
import React, { useState, useMemo } from 'react';
import { GameTemplate } from '../../../types';
import { X, Library, Check, Copy, Mail, AlertCircle, FileJson, Loader2 } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { generateId } from '../../../utils/idGenerator';
import { useDataManagerTranslation } from '../../../i18n/data_manager';
import { DATA_LIMITS } from '../../../dataLimits';

interface DataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTemplates: GameTemplate[];
  onImport: (templates: GameTemplate[]) => void;
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
}

const DataManagerModal: React.FC<DataManagerModalProps> = ({ isOpen, onClose, userTemplates, onImport, onGetFullTemplate }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([]);
  const [isExportCopying, setIsExportCopying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { showToast } = useToast();
  const { t } = useDataManagerTranslation();

  const allExportableTemplates = useMemo(() => {
    // 標記來源以便顯示
    return userTemplates.map(t => ({ ...t, _source: 'user' }));
  }, [userTemplates]);

  if (!isOpen) return null;

  // 統一處理 JSON 邏輯 (無論是貼上的還是檔案讀取的)
  const processJsonData = async (jsonString: string, source: 'paste' | 'file') => {
    // [UX] 先設定 Loading 狀態，並強制等待一個 tick 讓 UI 渲染出來
    setIsProcessing(true);
    setImportError(null);

    // 使用 setTimeout 將繁重的 Parsing 移出當前執行緒，避免按鈕點擊後 UI 凍結
    setTimeout(async () => {
      try {
        let parsed: any;
        try {
          parsed = JSON.parse(jsonString);
        } catch (e) {
          const msg = t('data_json_parse_err');
          setImportError(msg);
          if (source === 'file') alert(msg);
          setIsProcessing(false);
          return;
        }

        // 1. 系統備份檔偵測 (App 自己的備份檔)
        if (parsed.data && parsed.preferences && parsed.library) {
          alert(t('data_backup_detect'));
          setIsProcessing(false);
          return;
        }

        // 2. 一般模板匯入 (Array or Single Object)
        let itemsToImport: any[] = Array.isArray(parsed) ? parsed : [parsed];
        const validTemplates: GameTemplate[] = [];

        for (const item of itemsToImport) {
          // 寬鬆檢查：必須有名稱，且 columns 必須是陣列 (或是空陣列)
          if (!item.name || !Array.isArray(item.columns)) {
            const msg = t('data_error_format', { name: item.name || 'Unknown' });
            if (source === 'file') alert(msg);
            else setImportError(msg);
            setIsProcessing(false);
            return;
          }

          const { _source, ...cleanItem } = item;
          validTemplates.push({
            ...cleanItem,
            id: generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            columns: item.columns.map((col: any) => ({ ...col, id: col.id || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT) }))
          });
        }

        if (validTemplates.length > 0) {
          onImport(validTemplates);
          onClose();
          setImportJson('');
          showToast({ message: t('data_import_success', { count: validTemplates.length }), type: 'success' });
        } else {
          const msg = t('data_error_no_data');
          setImportError(msg);
          if (source === 'file') alert(msg);
        }

      } catch (e: any) {
        console.error(e);
        const msg = e.message || t('data_import_error');
        setImportError(msg);
        alert(`${t('data_import_fail_prefix')}${msg}`);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleManualImport = () => {
    if (!importJson.trim()) {
      showToast({ message: t('data_import_empty_ph'), type: 'warning' });
      return;
    }
    processJsonData(importJson, 'paste');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        processJsonData(result, 'file');
      }
    };
    reader.readAsText(file);
  };

  const prepareExportData = async () => {
    const promises = exportSelectedIds.map(async (id) => {
      const t = await onGetFullTemplate(id);
      if (!t) return null;
      return t;
    });

    const results = await Promise.all(promises);
    const cleanTemplates = results.filter((t): t is GameTemplate => t !== null);

    if (cleanTemplates.length === 0) return null;

    const templateStrings = cleanTemplates.map((t: any) => `  ${JSON.stringify(t)}`);
    return `[\n${templateStrings.join(',\n')}\n]`;
  };

  const handleExportCopy = async () => {
    if (exportSelectedIds.length === 0) return;

    try {
      const json = await prepareExportData();
      if (!json) throw new Error(t('data_error_empty'));

      navigator.clipboard.writeText(json).then(() => {
        setIsExportCopying(true);
        setTimeout(() => setIsExportCopying(false), 2000);
        showToast({ message: t('data_copy_success'), type: 'success' });
      });
    } catch (e) {
      showToast({ message: t('data_export_fail'), type: 'error' });
    }
  };

  const handleShareToDev = async () => {
    if (exportSelectedIds.length === 0) return;

    try {
      const json = await prepareExportData();
      if (!json) throw new Error(t('data_error_empty'));

      navigator.clipboard.writeText(json).then(() => {
        setIsExportCopying(true);
        setTimeout(() => setIsExportCopying(false), 2000);
        const email = "louieddxu2@gmail.com";
        const subject = t('data_mail_subject', { date: new Date().toLocaleDateString() });
        const body = t('data_mail_body');
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      });
    } catch (e) {
      showToast({ message: t('data_prep_fail'), type: 'error' });
    }
  };

  const toggleExportSelection = (id: string) => {
    setExportSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const isAllSelected = allExportableTemplates.length > 0 && exportSelectedIds.length === allExportableTemplates.length;
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setExportSelectedIds([]);
    } else {
      setExportSelectedIds(allExportableTemplates.map(t => t.id));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
        <div className="flex-none bg-slate-800 rounded-t-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Library size={20} className="text-emerald-500" /> {t('data_mgr_title')}
            </h3>
            <button onClick={onClose} disabled={isProcessing} className="text-slate-500 hover:text-white disabled:opacity-50"><X size={24} /></button>
          </div>
          <div className="flex">
            <button onClick={() => setActiveTab('import')} disabled={isProcessing} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'import' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>{t('data_import_tab')}</button>
            <button onClick={() => setActiveTab('export')} disabled={isProcessing} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'export' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>{t('data_export_tab')}</button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-hidden flex flex-col h-full min-h-0">
          {activeTab === 'import' && (
            <div className="flex flex-col h-full gap-4">
              <p className="text-sm text-slate-400 flex-none">{t('data_import_ph')}</p>
              <textarea
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                disabled={isProcessing}
                placeholder='[{"name":"Catan", ...}]'
                className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none disabled:opacity-50"
              />

              <div className="flex-none space-y-3">
                {importError && <p className="text-red-400 text-xs flex items-center gap-1 bg-red-900/10 p-2 rounded border border-red-900/30"><AlertCircle size={12} /> {importError}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col items-center justify-center gap-1 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 cursor-pointer transition-colors group ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2">
                      <FileJson size={20} className="text-indigo-400" />
                      <span className="text-xs text-white">{t('data_read_json_btn')}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 scale-90 group-hover:text-slate-400">{t('data_template_only')}</span>

                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      disabled={isProcessing}
                      onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                      onChange={handleFileChange}
                    />
                  </label>

                  <button
                    onClick={handleManualImport}
                    disabled={isProcessing}
                    className={`w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex flex-col items-center justify-center gap-0.5 ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isProcessing ? (
                      <span className="text-xs flex items-center gap-1"><Loader2 size={16} className="animate-spin" /> {t('data_processing')}</span>
                    ) : (
                      <span className="text-xs flex items-center gap-1"><Check size={16} /> {t('data_execute_import')}</span>
                    )}
                    <span className="text-[9px] text-emerald-100 opacity-80">{t('data_parse_content')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="flex flex-col h-full gap-2">
              <p className="text-sm text-slate-400 flex-none">{t('data_export_hint')}</p>

              <div className="flex-1 bg-slate-950/30 rounded-xl border border-slate-800 overflow-y-auto no-scrollbar p-2 space-y-1 min-h-0">
                {allExportableTemplates.length === 0 && <p className="text-center text-xs text-slate-500 py-8">{t('data_export_empty')}</p>}

                {allExportableTemplates.map((t: any) => {
                  return (
                    <div key={t.id} onClick={() => toggleExportSelection(t.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${exportSelectedIds.includes(t.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`text-sm truncate ${exportSelectedIds.includes(t.id) ? 'text-indigo-200 font-bold' : 'text-slate-300'}`}>{t.name}</span>
                      </div>
                      {exportSelectedIds.includes(t.id) && <Check size={16} className="text-indigo-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center flex-none">
                <span className="text-xs text-slate-500">{t('data_selected_count', { count: exportSelectedIds.length })}</span>
                <button onClick={handleToggleSelectAll} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors">
                  {isAllSelected ? t('data_deselect_all') : t('data_select_all')}
                </button>
              </div>

              <div className="flex-none grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <button onClick={handleExportCopy} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                  {isExportCopying ? <Check size={18} /> : <Copy size={18} />} {t('data_copy_json')}
                </button>
                <button onClick={handleShareToDev} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                  <Mail size={18} /> {t('data_mail_dev')}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center flex-none">{t('data_export_footer')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataManagerModal;
