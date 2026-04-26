
import React from 'react';
import { Link2, Check } from 'lucide-react';
import { useCommonTranslation } from '../../../i18n/common';

export interface LinkerItemProps {
  id: string | number;
  name: string;
  subTitle?: string;
  isLinked?: boolean; // For Right Side: Is currently linked to active selection. For Left: Is mapped.
  linkedName?: string; // [New] Name of the target it is linked to
  isSelected?: boolean;
  isSuggested?: boolean;
  statusColor?: string;
}

interface LinkerListProps {
  items: LinkerItemProps[];
  title: React.ReactNode;
  emptyMessage?: string;
  onItemClick: (id: string | number) => void;
  className?: string;
}

export const LinkerList: React.FC<LinkerListProps> = ({
  items,
  title,
  emptyMessage,
  onItemClick,
  className
}) => {
  const { t: tCommon } = useCommonTranslation();

  const finalEmptyMessage = emptyMessage || tCommon('none');

  return (
    <div className={`flex flex-col h-full min-w-0 ${className}`}>
      <div className="p-2 border-b border-surface-border text-[10px] font-bold text-txt-muted uppercase flex items-center gap-1.5 sticky top-0 bg-app-bg z-10">
        {title}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 relative" id="linker-list-container">
        {items.length === 0 ? (
          <div className="text-center py-10 text-txt-muted text-xs italic">{finalEmptyMessage}</div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              id={`linker-item-${item.id}`} // Add ID for scroll targeting
              onClick={() => onItemClick(item.id)}
              className={`
                p-2 rounded-lg text-xs border transition-all cursor-pointer relative flex flex-col gap-1
                ${item.isSelected
                  ? 'bg-brand-secondary border-brand-secondary/50 text-white shadow-md z-10 sticky-item-active' // Active Selection (Left)
                  : item.isLinked
                    ? 'bg-status-success/20 border-status-success text-status-success shadow-sm' // Active Linked (Right: Solid Green)
                    : item.isSuggested
                      ? 'bg-status-warning/10 border-status-warning/50 border-dashed text-txt-primary' // Suggested (Right: Dashed Yellow)
                      : 'bg-surface-bg border-surface-border text-txt-tertiary hover:bg-surface-hover' // Default
                }
                ${item.linkedName ? 'opacity-80' : ''} 
              `}
            >
              <div className="flex justify-between items-start">
                {/* For Left Side items that are linked but not selected, show visual hint */}
                <div className={`font-bold truncate pr-4 ${item.linkedName && !item.isSelected ? 'text-txt-muted decoration-txt-muted' : ''}`}>
                  {item.name}
                </div>
                {/* Only show check for Left Side items that are completed */}
                {item.linkedName && <Check size={12} className="text-status-success shrink-0" />}
              </div>

              {/* Linked Target Preview (Left Side Only usually) */}
              {item.linkedName && (
                <div className={`text-[10px] flex items-center gap-1 ${item.isSelected ? 'text-white/80' : 'text-status-success'}`}>
                  <Link2 size={10} />
                  <span className="truncate">{item.linkedName}</span>
                </div>
              )}

              {/* Subtitle (BGG ID etc) */}
              {item.subTitle && (!item.linkedName || item.isSelected) && (
                <div className={`text-[10px] font-mono ${item.isSelected || item.isLinked ? 'text-white/70' : 'text-txt-muted'}`}>
                  {item.subTitle}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
