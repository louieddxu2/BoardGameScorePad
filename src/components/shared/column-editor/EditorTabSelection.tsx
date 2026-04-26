
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
          <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('col_select_mode')}</label>
          <div className="grid grid-cols-2 gap-3">
              <button 
                  onClick={() => onChange({ isMultiSelect: false })} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${!column.isMultiSelect ? 'bg-status-info/10 border-status-info/50 text-status-info shadow-sm' : 'bg-modal-bg-elevated border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
              >
                  <div className="h-[24px] flex items-center justify-center">
                    <CircleDot size={22} />
                  </div>
                  <div className="leading-tight text-center">
                      <div className="text-xs font-black uppercase">{t('col_select_single')}</div>
                      <div className="text-[10px] font-bold opacity-60 truncate">{t('col_select_single_desc')}</div>
                  </div>
              </button>
              <button 
                  onClick={() => onChange({ isMultiSelect: true })} 
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${column.isMultiSelect ? 'bg-brand-primary/10 border-brand-primary/50 text-brand-primary shadow-sm' : 'bg-modal-bg-elevated border-surface-border text-txt-secondary hover:bg-surface-hover'}`}
              >
                  <div className="grid grid-cols-2 gap-1 h-[24px] items-center justify-center">
                    <CheckSquare size={11} strokeWidth={3} className={column.isMultiSelect ? 'text-brand-primary' : 'text-txt-muted'} />
                    <Square size={11} className="opacity-40" />
                    <Square size={11} className="opacity-40" />
                    <CheckSquare size={11} strokeWidth={3} className={column.isMultiSelect ? 'text-brand-primary' : 'text-txt-muted'} />
                  </div>
                  <div className="leading-tight text-center">
                      <div className="text-xs font-black uppercase">{t('col_select_multi')}</div>
                      <div className="text-[10px] font-bold opacity-60 truncate">{t('col_select_multi_desc')}</div>
                  </div>
              </button>
          </div>
      </div>

      <div className="space-y-2 pt-2">
          <label className="block text-xs font-bold text-txt-muted uppercase mb-2">{t('col_render_mode')}</label>
          <div className="flex bg-modal-bg-recessed rounded-xl p-1 border border-surface-border">
              <button onClick={() => onChange({ renderMode: 'standard' })} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${currentRenderMode === 'standard' ? 'bg-modal-bg text-status-info shadow-sm' : 'text-txt-secondary hover:text-txt-primary'}`}>
                  {t('col_render_std')}
              </button>
              <button onClick={() => onChange({ renderMode: 'value_only' })} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${currentRenderMode === 'value_only' ? 'bg-modal-bg text-status-info shadow-sm' : 'text-txt-secondary hover:text-txt-primary'}`}>
                  {t('col_render_val')}
              </button>
              <button onClick={() => onChange({ renderMode: 'label_only' })} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${currentRenderMode === 'label_only' ? 'bg-modal-bg text-status-info shadow-sm' : 'text-txt-secondary hover:text-txt-primary'}`}>
                  {t('col_render_label')}
              </button>
          </div>
      </div>

      <div className="bg-modal-bg-recessed p-4 rounded-xl border border-surface-border/50 space-y-4">
        <p className="text-sm text-txt-secondary">{t('col_select_desc')}</p>
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
