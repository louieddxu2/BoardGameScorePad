
import React from 'react';
import { ScoreColumn } from '../../../types';
import QuickActionsEditor from './QuickActionsEditor';

interface EditorTabSelectionProps {
  column: ScoreColumn;
  onChange: (updates: Partial<ScoreColumn>) => void;
}

const EditorTabSelection: React.FC<EditorTabSelectionProps> = ({ column, onChange }) => {
  
  const handleQuickActionsChange = (updates: any) => {
    onChange(updates);
  };

  const currentRenderMode = column.renderMode || 'standard';

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">顯示模式</label>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button onClick={() => onChange({ renderMode: 'standard' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentRenderMode === 'standard' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  標準
              </button>
              <button onClick={() => onChange({ renderMode: 'value_only' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentRenderMode === 'value_only' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  僅顯示數值
              </button>
              <button onClick={() => onChange({ renderMode: 'label_only' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentRenderMode === 'label_only' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  僅顯示標籤
              </button>
          </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
        <p className="text-sm text-slate-400">建立固定的選項列表，點按選擇對應到分數。</p>
        <QuickActionsEditor
          quickActions={column.quickActions || []}
          buttonGridColumns={column.buttonGridColumns}
          defaultColor={column.color}
          showModifierToggle={false}
          onChange={handleQuickActionsChange}
        />
      </div>
    </div>
  );
};

export default EditorTabSelection;
