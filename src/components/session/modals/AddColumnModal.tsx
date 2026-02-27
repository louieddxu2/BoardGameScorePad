
import React, { useState } from 'react';
import { ScoreColumn } from '../../../types';
import { ListPlus, Plus, CopyPlus, Square, CheckSquare, X } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';

interface AddColumnModalProps {
  columns: ScoreColumn[];
  onClose: () => void;
  onAddBlank: () => void;
  onCopy: (selectedIds: string[]) => void;
}

const AddColumnModal: React.FC<AddColumnModalProps> = ({ columns, onClose, onAddBlank, onCopy }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);

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
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-slate-900 w-3/4 max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-none bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><ListPlus size={20} className="text-emerald-500" /> {t('modal_add_col_title')}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 min-h-0">

          <p className="text-sm text-slate-400 font-bold flex-none">{t('modal_copy_existing')}</p>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 bg-slate-950/30 p-2 rounded-xl border border-slate-800 min-h-0">
            {columns.length === 0 && <div className="text-center text-slate-500 py-8 text-xs">{t('modal_no_cols')}</div>}
            {columns.map(col => {
              const isSelected = selectedColumnIds.includes(col.id);
              return (
                <div key={col.id} onClick={() => toggleSelection(col.id)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}>
                  {isSelected ? <CheckSquare size={20} className="text-indigo-500 shrink-0" /> : <Square size={20} className="text-slate-600 shrink-0" />}
                  <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>{col.name}</span>
                </div>
              );
            })}
          </div>

          {/* Select All Button (Bottom Right of List) */}
          <div className="flex justify-end flex-none">
            <button
              onClick={handleToggleSelectAll}
              disabled={columns.length === 0}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAllSelected ? tCommon('deselect_all') : tCommon('select_all')}
            </button>
          </div>

          {/* Copy Action */}
          <button onClick={handleCopy} disabled={selectedColumnIds.length === 0} className={`flex-none w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${selectedColumnIds.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
            <CopyPlus size={18} /> {t('modal_copy_count', { count: selectedColumnIds.length })}
          </button>

          {/* Divider */}
          <div className="relative py-1 flex-none">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">{t('modal_or')}</span></div>
          </div>

          {/* Add Blank Button (Very Bottom) */}
          <button onClick={onAddBlank} className="flex-none w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2 transition-colors active:scale-95 group">
            <Plus size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            {t('modal_add_blank')}
          </button>

        </div>
      </div>
    </div>
  );
};

export default AddColumnModal;
