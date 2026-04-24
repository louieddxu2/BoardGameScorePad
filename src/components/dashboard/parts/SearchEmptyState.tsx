
import React, { useState } from 'react';
import { PlayCircle, LayoutTemplate, Loader2 } from 'lucide-react';
import { useDashboardTranslation } from '../../../i18n/dashboard';

interface SearchEmptyStateProps {
  searchQuery: string;
  onCreate: (name?: string) => void;
  onQuickCreate: (name: string) => void;
  hasResults: boolean;
}

const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({ searchQuery, onCreate, onQuickCreate, hasResults }) => {
  const { t: tDash } = useDashboardTranslation();
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
      <div className="col-span-2 h-20 flex items-center justify-center text-txt-muted border-2 border-dashed border-surface-border/50 rounded-xl">
        <span className="text-sm italic">{tDash('dash_no_templates')}</span>
      </div>
    );
  }

  // Centered Block Style (Restored & Enhanced)
  return (
    <div className={`col-span-2 flex flex-col items-center justify-center py-6 px-4 gap-4 border-2 border-dashed border-surface-border/50 rounded-xl animate-in fade-in zoom-in-95 duration-300 ${hasResults ? 'mt-4 bg-surface-bg-alt/50' : ''}`}>

      {!hasResults && (
        <p className="text-txt-muted text-sm italic">
          {tDash('dash_no_search_results')}
        </p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        {/* Button 1: Original Create (Edit Mode) */}
        <button
          onClick={() => onCreate(searchQuery)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-bg text-txt-primary border border-surface-border rounded-xl hover:bg-surface-bg-alt transition-all active:scale-95 shadow-sm group"
        >
          <LayoutTemplate size={18} className="text-txt-muted group-hover:text-txt-primary transition-colors" />
          <span className="font-bold text-sm">
            {tDash('dash_create_btn', { name: searchQuery })}
          </span>
        </button>

        {/* Button 2: Create & Score (Quick Mode) - Primary Color */}
        <button
          onClick={handleQuickCreate}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-xl hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-95 shadow-sm group"
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
