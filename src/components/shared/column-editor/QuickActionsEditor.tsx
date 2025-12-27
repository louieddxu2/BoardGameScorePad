
import React, { useState } from 'react';
import { QuickAction } from '../../../types';
import { COLORS } from '../../../colors';
import { isColorDark } from '../../../utils/ui';
import { Plus, Trash2, Palette, X } from 'lucide-react';
import { generateId } from '../../../utils/idGenerator';

interface QuickActionsEditorProps {
  quickActions: QuickAction[];
  buttonGridColumns?: number;
  defaultColor?: string;
  showModifierToggle: boolean;
  onChange: (updates: { quickActions?: QuickAction[]; buttonGridColumns?: number }) => void;
}

const QuickActionsEditor: React.FC<QuickActionsEditorProps> = ({
  quickActions = [],
  buttonGridColumns = 1,
  defaultColor = '#ffffff',
  showModifierToggle,
  onChange,
}) => {
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);

  const handleAdd = () => {
    const newActions = [
      ...quickActions,
      {
        id: generateId(6), // Short ID for actions
        label: '',
        value: 1,
        isModifier: false,
      },
    ];
    onChange({ quickActions: newActions });
  };

  const handleRemove = (index: number) => {
    const newActions = quickActions.filter((_, i) => i !== index);
    onChange({ quickActions: newActions });
  };

  const handleUpdate = (index: number, field: keyof QuickAction, value: any) => {
    const newActions = [...quickActions];
    newActions[index] = { ...newActions[index], [field]: value };
    onChange({ quickActions: newActions });
  };

  const handleColumnsChange = (cols: number) => {
    onChange({ buttonGridColumns: cols });
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-400 uppercase">按鈕欄數</label>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            {[1, 2, 3, 4].map((cols) => (
              <button
                key={cols}
                onClick={() => handleColumnsChange(cols)}
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                  buttonGridColumns === cols ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cols}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-slate-500">
          {buttonGridColumns === 1
            ? '目前為「清單模式」：按鈕將橫向排列，最適合閱讀。'
            : '目前為「網格模式」：按鈕將縱向堆疊，節省空間。'}
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-4 space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase">按鈕列表</label>
        {quickActions.map((action, idx) => (
          <div
            key={action.id}
            className="bg-slate-800 p-2 rounded-lg border border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              {showModifierToggle && (
                <button
                  onClick={() => handleUpdate(idx, 'isModifier', !action.isModifier)}
                  className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                    action.isModifier
                      ? 'border-2 border-dashed border-indigo-400 bg-indigo-500/10 text-indigo-400'
                      : 'border border-slate-600 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-400'
                  }`}
                  title="切換為額外添加鍵"
                >
                  <Plus size={18} strokeWidth={action.isModifier ? 3 : 2} />
                </button>
              )}
              <button
                onClick={() => setColorPickerIdx(colorPickerIdx === idx ? null : idx)}
                className="w-9 h-9 shrink-0 rounded-lg border border-slate-600 flex items-center justify-center shadow-sm relative overflow-hidden"
                style={{ backgroundColor: action.color || defaultColor }}
                title="設定按鈕顏色"
              >
                <Palette
                  size={14}
                  className={
                    isColorDark(action.color || defaultColor) ? 'text-white/80' : 'text-black/50'
                  }
                />
              </button>
              <div className="flex-1 flex gap-2 min-w-0">
                <input
                  type="text"
                  placeholder="標籤"
                  value={action.label}
                  onChange={(e) => handleUpdate(idx, 'label', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-[40px] bg-slate-900 border border-slate-600 rounded p-2 text-white placeholder-slate-600 text-sm outline-none focus:border-emerald-500"
                />
                <div className="relative w-14 shrink-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={action.value}
                    onChange={(e) => {
                      const str = e.target.value;
                      if (
                        str === '-' ||
                        str === '' ||
                        str.endsWith('.') ||
                        (str.includes('.') && str.endsWith('0'))
                      ) {
                        handleUpdate(idx, 'value', str as any);
                        return;
                      }
                      const num = parseFloat(str);
                      if (!isNaN(num)) {
                        handleUpdate(idx, 'value', num);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-slate-900 border border-emerald-500/50 text-emerald-400 font-mono font-bold rounded p-2 pl-2 text-right text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                onClick={() => handleRemove(idx)}
                className="p-2 text-slate-500 hover:text-red-400 shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
            {colorPickerIdx === idx && (
              <div className="mt-2 p-2 bg-slate-900 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-1">
                <div className="flex flex-wrap gap-2 justify-start">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        handleUpdate(idx, 'color', c);
                        setColorPickerIdx(null);
                      }}
                      className={`w-6 h-6 rounded-full shadow-sm border ${
                        action.color === c
                          ? 'border-white scale-110'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      } ${isColorDark(c) ? 'ring-1 ring-white/30' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <button
                    onClick={() => {
                      handleUpdate(idx, 'color', undefined);
                      setColorPickerIdx(null);
                    }}
                    className={`w-6 h-6 rounded-full shadow-sm border flex items-center justify-center bg-slate-800 ${
                      !action.color ? 'border-white scale-110' : 'border-slate-600 text-slate-500'
                    }`}
                    title="重置為預設"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={handleAdd}
        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-dashed border-slate-600 flex items-center justify-center gap-2 text-sm"
      >
        <Plus size={16} /> 新增按鈕
      </button>
    </>
  );
};

export default QuickActionsEditor;
