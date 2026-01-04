
import React, { useState, useMemo } from 'react';
import { GameTemplate } from '../../../types';
import { X, Library, ArrowRightLeft, Check, Copy, Mail, AlertCircle } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { generateId } from '../../../utils/idGenerator';
import { db } from '../../../db'; // 直接存取 DB 以讀取 override
import { useLiveQuery } from 'dexie-react-hooks';

interface DataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTemplates: GameTemplate[];
  onImport: (templates: GameTemplate[]) => void;
}

const DataManagerModal: React.FC<DataManagerModalProps> = ({ isOpen, onClose, userTemplates, onImport }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([]);
  const [isExportCopying, setIsExportCopying] = useState(false);
  const { showToast } = useToast();

  // 讀取系統覆寫資料，讓使用者也能匯出他們的修改
  const systemOverrides = useLiveQuery(() => db.systemOverrides.toArray(), [], []);

  const allExportableTemplates = useMemo(() => {
      const overrides = systemOverrides || [];
      // 標記來源以便顯示
      const taggedUser = userTemplates.map(t => ({ ...t, _source: 'user' }));
      const taggedOverrides = overrides.map(t => ({ ...t, _source: 'system' }));
      return [...taggedUser, ...taggedOverrides];
  }, [userTemplates, systemOverrides]);

  if (!isOpen) return null;

  const handleImportJSON = () => {
    try {
      setImportError(null);
      if (!importJson.trim()) return;
      const parsed = JSON.parse(importJson);
      let itemsToImport: any[] = Array.isArray(parsed) ? parsed : [parsed];
      const validTemplates: GameTemplate[] = [];
      
      itemsToImport.forEach(item => {
        if (!item.name || !Array.isArray(item.columns)) throw new Error(`格式錯誤：${item.name || '未命名'} 缺少必要欄位`);
        
        // 移除 _source 標記 (如果有的話)
        const { _source, ...cleanItem } = item;

        validTemplates.push({
          ...cleanItem,
          id: generateId(), // Refresh ID to avoid conflicts
          createdAt: Date.now(),
          updatedAt: Date.now(),
          columns: item.columns.map((col: any) => ({ ...col, id: col.id || generateId(8) }))
        });
      });

      if (validTemplates.length > 0) {
        onImport(validTemplates);
        onClose();
        setImportJson('');
        showToast({ message: `成功匯入 ${validTemplates.length} 個遊戲`, type: 'success' });
      } else {
        setImportError("沒有可匯入的有效資料");
      }
    } catch (e: any) {
      setImportError(e.message || "無效的 JSON 格式");
    }
  };

  const handleExportCopy = () => {
    const selectedTemplates = allExportableTemplates.filter(t => exportSelectedIds.includes(t.id));
    if (selectedTemplates.length === 0) return;
    
    // 移除內部使用的 _source 標記後再匯出
    const cleanTemplates = selectedTemplates.map(({ _source, ...t }: any) => t);
    
    const templateStrings = cleanTemplates.map((t: any) => `  ${JSON.stringify(t)}`);
    const json = `[\n${templateStrings.join(',\n')}\n]`;
    
    navigator.clipboard.writeText(json).then(() => {
      setIsExportCopying(true);
      setTimeout(() => setIsExportCopying(false), 2000);
      showToast({ message: "已複製到剪貼簿", type: 'success' });
    });
  };

  const handleShareToDev = () => {
    const selectedTemplates = allExportableTemplates.filter(t => exportSelectedIds.includes(t.id));
    if (selectedTemplates.length === 0) return;
    
    const cleanTemplates = selectedTemplates.map(({ _source, ...t }: any) => t);
    const templateStrings = cleanTemplates.map((t: any) => `  ${JSON.stringify(t)}`);
    const json = `[\n${templateStrings.join(',\n')}\n]`;
    
    navigator.clipboard.writeText(json).then(() => {
      setIsExportCopying(true);
      setTimeout(() => setIsExportCopying(false), 2000);
      const email = "louieddxu2@gmail.com";
      const subject = `【萬用桌遊計分板】分享遊戲模板 (${new Date().toLocaleDateString()})`;
      const body = `開發者你好！這是我製作的計分板\n↓↓↓ 資料已複製，請在下方貼上(Ctrl+V)↓↓↓\n--------------------------------------------------\n\n--------------------------------------------------`;
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }).catch(err => {
      console.error("Failed to copy:", err);
      showToast({ title: "自動複製失敗", message: "請手動複製後再寄信。", type: 'error' });
    });
  };

  const toggleExportSelection = (id: string) => {
    setExportSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
        <div className="flex-none bg-slate-800 rounded-t-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Library size={20} className="text-emerald-500" /> 資料管理
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
          </div>
          <div className="flex">
            <button onClick={() => setActiveTab('import')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'import' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>匯入資料</button>
            <button onClick={() => setActiveTab('export')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'export' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>匯出分享</button>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">請貼上其他裝置分享的 JSON 資料：</p>
              <textarea 
                value={importJson} 
                onChange={e => setImportJson(e.target.value)} 
                placeholder='[{"name":"Catan", ...}]' 
                className="w-full h-64 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none"
              />
              {importError && <p className="text-red-400 text-xs flex items-center gap-1"><X size={12}/> {importError}</p>}
              <button onClick={handleImportJSON} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50">匯入至我的遊戲庫</button>
              
              <div className="bg-amber-900/20 p-3 rounded-lg border border-amber-500/20 text-[11px] text-amber-500/80 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>匯入的遊戲將會儲存為「自訂遊戲」，不會覆蓋您現有的內建遊戲設定。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">選擇要匯出的遊戲：</p>
              <div className="bg-slate-800 rounded-xl border border-slate-700 max-h-64 overflow-y-auto no-scrollbar p-2 space-y-1">
                {allExportableTemplates.length === 0 && <p className="text-center text-xs text-slate-500 py-4">沒有可匯出的自訂遊戲或修改紀錄</p>}
                
                {allExportableTemplates.map((t: any) => {
                  const isSystemOverride = t._source === 'system';
                  return (
                    <div key={t.id} onClick={() => toggleExportSelection(t.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${exportSelectedIds.includes(t.id) ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-transparent border-transparent hover:bg-slate-700'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                          <span className={`text-sm truncate ${exportSelectedIds.includes(t.id) ? 'text-indigo-200 font-bold' : 'text-slate-300'}`}>{t.name}</span>
                          {isSystemOverride && <span className="text-[10px] bg-amber-900/40 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">內建修改</span>}
                      </div>
                      {exportSelectedIds.includes(t.id) && <Check size={16} className="text-indigo-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setExportSelectedIds(allExportableTemplates.map(t => t.id))} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2">全選</button>
                <button onClick={() => setExportSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-400 px-2">取消全選</button>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={handleExportCopy} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                  {isExportCopying ? <Check size={18} /> : <Copy size={18} />} 複製 JSON
                </button>
                <button onClick={handleShareToDev} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                  <Mail size={18} /> 投稿給開發者
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">選取的遊戲將轉為 JSON 文字，可分享給朋友匯入。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataManagerModal;
