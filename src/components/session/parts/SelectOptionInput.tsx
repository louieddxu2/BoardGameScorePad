import React from 'react';
import { ScoreColumn } from '../../../types';

interface SelectOptionInputProps {
  column: ScoreColumn;
  currentValue: any;
  onSelect: (value: any) => void;
}

const SelectOptionInput: React.FC<SelectOptionInputProps> = ({
  column,
  currentValue,
  onSelect,
}) => {
  let options: { label: string, value: any, scoreDisplay: number }[] = [];
  if (column.type === 'boolean') {
    options = [
      { label: 'YES (達成)', value: true, scoreDisplay: column.weight ?? 0 },
      { label: 'NO (未達成)', value: false, scoreDisplay: 0 }
    ];
  } else if (column.options) {
    options = column.options.map(o => ({ ...o, scoreDisplay: o.value }));
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar space-y-2 p-2">
      {options.map((opt, i) => {
        const isActive = (column.type === 'boolean' && currentValue === opt.value) ||
                       (column.type === 'select' && (typeof currentValue === 'number' ? currentValue : currentValue?.value) === opt.value);
        return (
          <button
            key={i}
            onClick={() => onSelect(opt.value)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-95 ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-white' : 'border-slate-500'}`}>{isActive && <div className="w-2 h-2 rounded-full bg-white" />}</div>
              <span className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-300'}`}>{opt.label}</span>
            </div>
            <span className={`text-sm font-mono px-2 py-1 rounded ${isActive ? 'bg-black/20 text-white' : 'bg-slate-900 text-emerald-400'}`}>{opt.scoreDisplay} 分</span>
          </button>
        );
      })}
    </div>
  );
};

export default SelectOptionInput;