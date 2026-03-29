
import { ScoreColumn } from '../../../types';
import QuickActionsEditor from './QuickActionsEditor';
import { useColumnEditorTranslation } from '../../../i18n/column_editor'; // Changed Import
import { CircleDot, CheckSquare, Square } from 'lucide-react';

interface EditorTabSelectionProps {
  column: ScoreColumn;
  onChange: (updates: Partial<ScoreColumn>) => void;
}

const EditorTabSelection: React.FC<EditorTabSelectionProps> = ({ column, onChange }) => {
  const { t } = useColumnEditorTranslation(); // Use New Hook
  
  const handleQuickActionsChange = (updates: any) => {
    onChange(updates);
  };

  const currentRenderMode = column.renderMode || 'standard';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Selection Mode Switcher */}
      <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('col_select_mode')}</label>
          <div className="grid grid-cols-2 gap-3">
              <button 
                  onClick={() => onChange({ isMultiSelect: false })} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${!column.isMultiSelect ? 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}
              >
                  <div className="h-[24px] flex items-center justify-center">
                    <CircleDot size={22} />
                  </div>
                  <div className="leading-tight text-center">
                      <div className="text-xs font-bold uppercase">{t('col_select_single')}</div>
                      <div className="text-[10px] opacity-70 truncate">{t('col_select_single_desc')}</div>
                  </div>
              </button>
              <button 
                  onClick={() => onChange({ isMultiSelect: true })} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${column.isMultiSelect ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750'}`}
              >
                  <div className="grid grid-cols-2 gap-1 h-[24px] items-center justify-center">
                    <CheckSquare size={11} strokeWidth={3} className={column.isMultiSelect ? 'text-emerald-400' : 'text-slate-500'} />
                    <Square size={11} className="opacity-40" />
                    <Square size={11} className="opacity-40" />
                    <CheckSquare size={11} strokeWidth={3} className={column.isMultiSelect ? 'text-emerald-400' : 'text-slate-500'} />
                  </div>
                  <div className="leading-tight text-center">
                      <div className="text-xs font-bold uppercase">{t('col_select_multi')}</div>
                      <div className="text-[10px] opacity-70 truncate">{t('col_select_multi_desc')}</div>
                  </div>
              </button>
          </div>
      </div>

      <div className="space-y-2 pt-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('col_render_mode')}</label>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button onClick={() => onChange({ renderMode: 'standard' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentRenderMode === 'standard' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t('col_render_std')}
              </button>
              <button onClick={() => onChange({ renderMode: 'value_only' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentRenderMode === 'value_only' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t('col_render_val')}
              </button>
              <button onClick={() => onChange({ renderMode: 'label_only' })} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${currentRenderMode === 'label_only' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t('col_render_label')}
              </button>
          </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
        <p className="text-sm text-slate-400">{t('col_select_desc')}</p>
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
