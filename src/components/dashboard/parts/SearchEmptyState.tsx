
import React, { useState } from 'react';
import { PlayCircle, LayoutTemplate, Loader2 } from 'lucide-react';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useTranslation } from '../../../i18n';

interface SearchEmptyStateProps {
  searchQuery: string;
  onCreate: (name?: string) => void;
  onQuickCreate: (name: string) => void;
  hasResults: boolean;
}

const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({ searchQuery, onCreate, onQuickCreate, hasResults }) => {
  const { t: tDash } = useDashboardTranslation();
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);

  const handleQuickCreate = () => {
      setIsCreating(true);
      // Small delay to show feedback
      setTimeout(() => {
          onQuickCreate(searchQuery);
          setIsCreating(false);
      }, 50);
  };

  if (!searchQuery) {
    return (
      <div className="col-span-2 h-20 flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
        <span className="text-sm italic">{t('dash_no_templates')}</span>
      </div>
    );
  }

  // Centered Block Style (Restored & Enhanced)
  return (
    <div className={`col-span-2 flex flex-col items-center justify-center py-6 px-4 gap-4 border-2 border-dashed border-slate-800/50 rounded-xl animate-in fade-in zoom-in-95 duration-300 ${hasResults ? 'mt-4 bg-slate-900/30' : ''}`}>
      
      {!hasResults && (
          <p className="text-slate-500 text-sm italic">
            {t('dash_no_search_results')}
          </p>
      )}
      
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
          {/* Button 1: Original Create (Edit Mode) */}
          <button 
            onClick={() => onCreate(searchQuery)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-all active:scale-95 shadow-sm group"
          >
            <LayoutTemplate size={18} className="text-slate-400 group-hover:text-white transition-colors" />
            <span className="font-bold text-sm">
                {tDash('dash_create_btn', { name: searchQuery })}
            </span>
          </button>

          {/* Button 2: Create & Score (Quick Mode) - Primary Color */}
          <button 
            onClick={handleQuickCreate}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all active:scale-95 shadow-sm group"
          >
            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} className="group-hover:scale-110 transition-transform" />}
            <span className="font-bold text-sm">
                {isCreating ? tDash('dash_creating') : tDash('dash_quick_play_btn', { name: searchQuery })}
            </span>
          </button>
      </div>

    </div>
  );
};

export default SearchEmptyState;
