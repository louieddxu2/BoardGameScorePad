
import React, { useState } from 'react';
import { ScoreColumn } from '../../../types';
import { ListPlus, Plus, CopyPlus, Square, CheckSquare, X } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

interface AddColumnModalProps {
  isOpen: boolean;
  columns: ScoreColumn[];
  onClose: () => void;
  onAddBlank: () => void;
  onCopy: (selectedIds: string[]) => void;
}

const AddColumnModal: React.FC<AddColumnModalProps> = ({ isOpen, columns, onClose, onAddBlank, onCopy }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'add-column');

  if (!isOpen) return null;

  const toggleSelection = (colId: string) => {
    setSelectedColumnIds(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const isAllSelected = columns.length > 0 && selectedColumnIds.length === columns.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedColumnIds([]);
    } else {
      setSelectedColumnIds(columns.map(c => c.id));
    }
  };

  const handleCopy = () => {
    if (selectedColumnIds.length === 0) return;
    onCopy(selectedColumnIds);
  };

  return (
    <div 
      className="fixed inset-0 bg-modal-backdrop/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" 
      style={{ zIndex }}
      onClick={onClose}
    >
      <div className="bg-modal-bg w-3/4 max-w-md rounded-2xl shadow-2xl border border-modal-border flex flex-col h-[600px] max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-none bg-modal-bg-elevated p-4 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-txt-title flex items-center gap-2"><ListPlus size={20} className="text-brand-primary" /> {t('modal_add_col_title')}</h3>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-title"><X size={24} /></button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 min-h-0">

          <p className="text-sm text-txt-secondary font-bold flex-none">{t('modal_copy_existing')}</p>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 bg-modal-bg-recessed/30 p-2 rounded-xl border border-modal-border min-h-0">
            {columns.length === 0 && <div className="text-center text-txt-muted py-8 text-xs">{t('modal_no_cols')}</div>}
            {columns.map(col => {
              const isSelected = selectedColumnIds.includes(col.id);
              return (
                <div key={col.id} onClick={() => toggleSelection(col.id)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-brand-secondary/20 border-brand-secondary/50' : 'bg-modal-bg-elevated border-surface-border hover:bg-surface-hover'}`}>
                  {isSelected ? <CheckSquare size={20} className="text-brand-secondary shrink-0" /> : <Square size={20} className="text-txt-muted shrink-0" />}
                  <span className={`text-sm font-bold truncate ${isSelected ? 'text-txt-title' : 'text-txt-tertiary'}`}>{col.name}</span>
                </div>
              );
            })}
          </div>

          {/* Select All Button (Bottom Right of List) */}
          <div className="flex justify-end flex-none">
            <button
              onClick={handleToggleSelectAll}
              disabled={columns.length === 0}
              className="text-xs text-brand-secondary hover:opacity-80 font-bold px-2 py-1 rounded hover:bg-modal-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAllSelected ? tCommon('deselect_all') : tCommon('select_all')}
            </button>
          </div>

          {/* Copy Action */}
          <button onClick={handleCopy} disabled={selectedColumnIds.length === 0} className={`flex-none w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${selectedColumnIds.length > 0 ? 'bg-brand-primary-deep hover:bg-brand-primary text-white' : 'bg-surface-border text-txt-muted cursor-not-allowed'}`}>
            <CopyPlus size={18} /> {t('modal_copy_count', { count: selectedColumnIds.length })}
          </button>

          {/* Divider */}
          <div className="relative py-1 flex-none">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-modal-border"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-modal-bg px-2 text-txt-muted">{t('modal_or')}</span></div>
          </div>

          {/* Add Blank Button (Very Bottom) */}
          <button onClick={onAddBlank} className="flex-none w-full py-3 bg-modal-bg-elevated hover:bg-surface-hover text-txt-tertiary font-bold rounded-xl border border-dashed border-surface-border-hover flex items-center justify-center gap-2 transition-colors active:scale-95 group">
            <Plus size={18} className="text-brand-primary group-hover:scale-110 transition-transform" />
            {t('modal_add_blank')}
          </button>

        </div>
      </div>
    </div>
  );
};

export default AddColumnModal;
