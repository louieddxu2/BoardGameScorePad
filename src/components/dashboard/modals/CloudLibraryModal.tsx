import React, { useState, useEffect } from 'react';
import { GameTemplate } from '../../../types';
import { X, Cloud, Loader2, Download, Check, HelpCircle, Trophy } from 'lucide-react';
import { fetchPublicTemplates } from '../../../services/templateShareService';
import { useCloudLibraryTranslation } from '../../../i18n/cloud_library';
import { useToast } from '../../../hooks/useToast';
import { generateId } from '../../../utils/idGenerator';
import { DATA_LIMITS } from '../../../dataLimits';

interface CloudLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTemplates: GameTemplate[];
  onImport: (templates: GameTemplate[]) => void;
}

interface CloudItem {
  id: string;
  name: string;
  downloadCount: number;
  createdAt: number;
  payload: any; // The full GameTemplate object
}

const CloudLibraryModal: React.FC<CloudLibraryModalProps> = ({
  isOpen,
  onClose,
  userTemplates,
  onImport
}) => {
  const { t } = useCloudLibraryTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cloudItems, setCloudItems] = useState<CloudItem[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [isImportingAll, setIsImportingAll] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadCloudTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const rawTemplates = await fetchPublicTemplates();
        
        // Map to local CloudItem format
        const items: CloudItem[] = rawTemplates.map((rt: any) => ({
          id: rt.id,
          name: rt.name,
          downloadCount: rt.downloadCount || 0,
          createdAt: rt.createdAt || Date.now(),
          payload: rt.payload
        }));
        
        setCloudItems(items);
      } catch (err) {
        console.error("Failed to load cloud templates", err);
        setError(t('lib_error'));
      } finally {
        setLoading(false);
      }
    };

    loadCloudTemplates();
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper: check if already in local library by name matching
  const isAlreadyImported = (name: string): boolean => {
    return userTemplates.some(ut => ut.name.trim().toLowerCase() === name.trim().toLowerCase());
  };

  // Convert payload item to a valid local GameTemplate structure
  const createLocalTemplate = (payload: any): GameTemplate => {
    const cleanColumns = Array.isArray(payload.columns)
      ? payload.columns.map((col: any) => ({
          ...col,
          id: col.id || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT)
        }))
      : [];

    return {
      ...payload,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      columns: cleanColumns
    };
  };

  // Import single template
  const handleSingleImport = async (item: CloudItem) => {
    if (isAlreadyImported(item.name)) {
      showToast({ message: t('lib_import_already'), type: 'warning' });
      return;
    }

    setImportingId(item.id);
    // Simulate slight lag for delightful feedback
    setTimeout(() => {
      try {
        const localTemplate = createLocalTemplate(item.payload || item);
        onImport([localTemplate]);
        showToast({
          message: t('lib_import_success', { name: item.name }),
          type: 'success'
        });
      } catch (e) {
        console.error(e);
        showToast({ message: 'Import failed', type: 'error' });
      } finally {
        setImportingId(null);
      }
    }, 400);
  };

  // Import all templates
  const handleImportAll = async () => {
    const importableItems = cloudItems.filter(item => !isAlreadyImported(item.name));
    if (importableItems.length === 0) {
      showToast({ message: t('lib_import_already'), type: 'warning' });
      return;
    }

    setIsImportingAll(true);
    setTimeout(() => {
      try {
        const templatesToImport = importableItems.map(item => createLocalTemplate(item.payload || item));
        onImport(templatesToImport);
        showToast({
          message: t('lib_import_all_success', { count: templatesToImport.length }),
          type: 'success'
        });
        onClose(); // Automatically close modal after successfully downloading all
      } catch (e) {
        console.error(e);
        showToast({ message: 'Batch import failed', type: 'error' });
      } finally {
        setIsImportingAll(false);
      }
    }, 600);
  };

  const hasImportableItems = cloudItems.some(item => !isAlreadyImported(item.name));

  return (
    <div
      className="modal-backdrop z-50 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importingId && !isImportingAll) onClose();
      }}
    >
      <div className="modal-container w-full max-w-lg flex flex-col h-[580px] max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex-none modal-bg-elevated rounded-t-2xl border-b border-surface-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
              <Cloud size={20} className="text-brand-primary" /> {t('lib_title')}
            </h3>
            <button
              onClick={onClose}
              disabled={!!importingId || isImportingAll}
              className="text-txt-muted hover:text-txt-primary disabled:opacity-50 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-xs text-txt-muted mt-1.5 leading-relaxed">
            {t('lib_subtitle')}
          </p>
        </div>

        {/* Body */}
        <div className="modal-body flex-1 p-4 overflow-y-auto no-scrollbar min-h-0">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={36} className="text-brand-primary animate-spin" />
              <span className="text-sm font-semibold text-txt-secondary">{t('lib_loading')}</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-status-danger/15 flex items-center justify-center text-status-danger mb-3">
                <HelpCircle size={24} />
              </div>
              <p className="text-sm text-status-danger font-semibold mb-2">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  // Trigger reload
                  const load = async () => {
                    try {
                      const raw = await fetchPublicTemplates();
                      setCloudItems(raw.map((rt: any) => ({
                        id: rt.id,
                        name: rt.name,
                        downloadCount: rt.downloadCount || 0,
                        createdAt: rt.createdAt || Date.now(),
                        payload: rt.payload
                      })));
                    } catch (e) {
                      setError(t('lib_error'));
                    } finally {
                      setLoading(false);
                    }
                  };
                  load();
                }}
                className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:filter hover:brightness-110 active:scale-95 transition-all"
              >
                Retry
              </button>
            </div>
          ) : cloudItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-txt-muted">
              <Cloud size={40} className="opacity-40 mb-2" />
              <span className="text-sm">{t('lib_no_data')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Import All Action Header */}
              {hasImportableItems && (
                <div className="flex justify-end items-center py-1 flex-none">
                  <button
                    onClick={handleImportAll}
                    disabled={isImportingAll || !!importingId}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-primary to-brand-secondary rounded-xl shadow-lg hover:filter hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isImportingAll ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t('lib_loading')}
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        {t('lib_btn_import_all')}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Grid of Templates */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {cloudItems.map((item) => {
                  const imported = isAlreadyImported(item.name);
                  const isSingleImporting = importingId === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col justify-between p-3.5 rounded-xl border modal-bg-elevated transition-all relative overflow-hidden group hover:scale-[1.01] ${
                        imported
                          ? 'border-status-success/30 bg-status-success/5 shadow-inner'
                          : 'border-surface-border hover:border-brand-primary/50 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Badge / Download Count */}
                      <div className="absolute top-2 right-2.5 flex items-center gap-1 text-[10px] text-txt-muted font-mono opacity-80 scale-90">
                        <Trophy size={10} className="text-status-warning shrink-0" />
                        <span>{t('lib_download_count', { count: item.downloadCount })}</span>
                      </div>

                      <div className="mb-4 pr-16">
                        <h4 className="font-bold text-sm text-txt-primary truncate group-hover:text-brand-primary transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-txt-muted mt-1 line-clamp-2 leading-relaxed">
                          {item.payload?.description || item.payload?.columns?.length + " cols"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-border/60">
                        {/* Number of columns info */}
                        <span className="text-[10px] bg-surface-alt px-2 py-0.5 rounded font-mono text-txt-secondary">
                          {item.payload?.columns?.length || 0} cols
                        </span>

                        {/* Action button */}
                        {imported ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-status-success py-1.5 px-2">
                            <Check size={14} />
                            <span>{t('lib_btn_imported')}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSingleImport(item)}
                            disabled={!!importingId || isImportingAll}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-brand-primary/30 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isSingleImporting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                            <span>{t('lib_btn_import')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudLibraryModal;
