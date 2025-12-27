
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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
