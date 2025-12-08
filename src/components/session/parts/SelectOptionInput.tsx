import React from 'react';
import { ScoreColumn } from '../../../types';
import { ArrowRight, ArrowDown } from 'lucide-react';

interface SelectOptionInputProps {
  column: ScoreColumn;
  currentValue: any;
  onSelect: (value: any) => void;
  onNext: () => void;
  direction: 'horizontal' | 'vertical';
}

const SelectOptionInput: React.FC<SelectOptionInputProps> = ({
  column,
  currentValue,
  onSelect,
  onNext,
  direction
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
    <div className="p-2 grid grid-cols-4 gap-2 h-full">
      <div className="col-span-3 h-full overflow-y-auto custom-scrollbar space-y-2 p-1">
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
      <div className="col-span-1 flex flex-col">
        <button
          onClick={onNext}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex flex-col items-center justify-center shadow-lg shadow-emerald-900/50 touch-manipulation transition-all active:scale-95"
        >
          {direction === 'horizontal' ? <ArrowRight size={24} /> : <ArrowDown size={24} />}
        </button>
      </div>
    </div>
  );
};

export default SelectOptionInput;
