import React, { useState } from 'react';
import { ScoreColumn } from '../../../types';
import { ListPlus, Plus, CopyPlus, Square, CheckSquare, X } from 'lucide-react';

interface AddColumnModalProps {
  columns: ScoreColumn[];
  onClose: () => void;
  onAddBlank: () => void;
  onCopy: (selectedIds: string[]) => void;
}

const AddColumnModal: React.FC<AddColumnModalProps> = ({ columns, onClose, onAddBlank, onCopy }) => {
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);

  const toggleSelection = (colId: string) => {
    setSelectedColumnIds(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const handleSelectAll = () => {
    if (selectedColumnIds.length === columns.length) {
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
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
        <div className="flex-none bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><ListPlus size={20} className="text-emerald-500" /> 新增計分項目</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
        </div>
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4">
          <button onClick={onAddBlank} className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl border border-slate-600 flex items-center justify-center gap-2 transition-colors active:scale-95">
            <Plus size={20} /> 新增一個空白項目
          </button>
          <div className="flex flex-col flex-1 overflow-hidden border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm text-slate-400">或從現有項目複製：</p>
              <button onClick={handleSelectAll} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">
                {selectedColumnIds.length === columns.length && columns.length > 0 ? '取消全選' : '全選'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {columns.map(col => {
                const isSelected = selectedColumnIds.includes(col.id);
                return (
                  <div key={col.id} onClick={() => toggleSelection(col.id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}>
                    {isSelected ? <CheckSquare size={20} className="text-indigo-500 shrink-0" /> : <Square size={20} className="text-slate-600 shrink-0" />}
                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>{col.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex-none p-4 bg-slate-800 border-t border-slate-700">
          <button onClick={handleCopy} disabled={selectedColumnIds.length === 0} className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${selectedColumnIds.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
            <CopyPlus size={18} /> 複製 {selectedColumnIds.length} 個項目
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddColumnModal;