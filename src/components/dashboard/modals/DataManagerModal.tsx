
import React, { useState, useMemo, useEffect } from 'react';
import { GameTemplate } from '../../../types';
import { X, Library, ArrowRightLeft, Check, Copy, Mail, AlertCircle, Square, CheckSquare } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { generateId } from '../../../utils/idGenerator';
import { db } from '../../../db'; // 直接存取 DB 以讀取 override
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '../../../i18n';
import { DATA_LIMITS } from '../../../dataLimits';

interface DataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTemplates: GameTemplate[]; // Now shallow
  onImport: (templates: GameTemplate[]) => void;
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
}

const DataManagerModal: React.FC<DataManagerModalProps> = ({ isOpen, onClose, userTemplates, onImport, onGetFullTemplate }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([]);
  const [isExportCopying, setIsExportCopying] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();

  // Handle Back Button
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: 'data' }, '');
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

  // 讀取系統覆寫資料 (Shallow)
  const systemOverrides = useLiveQuery(async () => {
      // Manual shallow mapping for overrides to match userTemplates structure
      return await db.systemOverrides.toArray(list => list.map(t => ({
         id: t.id, name: t.name, updatedAt: t.updatedAt, createdAt: t.createdAt,
         isPinned: t.isPinned, hasImage: t.hasImage, cloudImageId: t.cloudImageId,
         columns: [], globalVisuals: undefined
      } as GameTemplate)));
  }, [], []);

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
        if (!item.name || !Array.isArray(item.columns)) throw new Error(t('data_error_format', { name: item.name || 'Unknown' }));
        
        const { _source, ...cleanItem } = item;

        validTemplates.push({
          ...cleanItem,
          id: generateId(), // Refresh ID
          createdAt: Date.now(),
          updatedAt: Date.now(),
          columns: item.columns.map((col: any) => ({ ...col, id: col.id || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT) }))
        });
      });

      if (validTemplates.length > 0) {
        onImport(validTemplates);
        onClose();
        setImportJson('');
        showToast({ message: t('data_import_success', { count: validTemplates.length }), type: 'success' });
      } else {
        setImportError(t('data_error_no_data'));
      }
    } catch (e: any) {
      setImportError(e.message || t('data_import_error'));
    }
  };

  const prepareExportData = async () => {
      const promises = exportSelectedIds.map(async (id) => {
          const t = await onGetFullTemplate(id);
          if (!t) return null;
          // Clean _source if it existed in the meta object (getTemplate returns raw template so it's clean)
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
            showToast({ message: t('ss_copy_success'), type: 'success' });
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

  // Logic for unified select/deselect all button
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
            if (e.target === e.currentTarget) onClose();
        }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
        <div className="flex-none bg-slate-800 rounded-t-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Library size={20} className="text-emerald-500" /> {t('data_mgr_title')}
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
          </div>
          <div className="flex">
            <button onClick={() => setActiveTab('import')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'import' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>{t('data_import_tab')}</button>
            <button onClick={() => setActiveTab('export')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'export' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>{t('data_export_tab')}</button>
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-hidden flex flex-col h-full min-h-0">
          {activeTab === 'import' ? (
            <div className="flex flex-col h-full gap-4">
              <p className="text-sm text-slate-400 flex-none">{t('data_import_ph')}</p>
              <textarea 
                value={importJson} 
                onChange={e => setImportJson(e.target.value)} 
                placeholder='[{"name":"Catan", ...}]' 
                className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none"
              />
              <div className="flex-none space-y-4">
                {importError && <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12}/> {importError}</p>}
                <button onClick={handleImportJSON} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50">{t('data_import_btn')}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full gap-2">
              <p className="text-sm text-slate-400 flex-none">{t('data_export_hint')}</p>
              
              <div className="flex-1 bg-slate-950/30 rounded-xl border border-slate-800 overflow-y-auto no-scrollbar p-2 space-y-1 min-h-0">
                {allExportableTemplates.length === 0 && <p className="text-center text-xs text-slate-500 py-8">{t('data_export_empty')}</p>}
                
                {allExportableTemplates.map((t: any) => {
                  const isSystemOverride = t._source === 'system';
                  return (
                    <div key={t.id} onClick={() => toggleExportSelection(t.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${exportSelectedIds.includes(t.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                          <span className={`text-sm truncate ${exportSelectedIds.includes(t.id) ? 'text-indigo-200 font-bold' : 'text-slate-300'}`}>{t.name}</span>
                          {isSystemOverride && <span className="text-[10px] bg-amber-900/40 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">{t('data_builtin_mod')}</span>}
                      </div>
                      {exportSelectedIds.includes(t.id) && <Check size={16} className="text-indigo-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
              
              {/* Select All Button (Bottom Right of List) */}
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
