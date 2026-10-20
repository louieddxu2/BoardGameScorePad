
import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  titleColorClass?: string; // e.g. "text-txt-title"
  iconColorClass?: string; // e.g. "text-brand-primary"
  actionButton?: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean; // For new badge logic
  compact?: boolean;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  titleColorClass = "text-txt-primary",
  iconColorClass = "text-txt-muted",
  actionButton,
  children,
  highlight = false,
  compact = false
}) => {
  if (count === 0 && !actionButton) return null;

  return (
    <div data-expanded={isOpen} className={`dashboard-section ${compact ? 'mb-4 last:mb-4' : 'mb-6 last:mb-5'} animate-in fade-in duration-500`}>
      <div 
        onClick={onToggle} 
        className={`dashboard-section-control flex items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-alt cursor-pointer hover:bg-surface-hover transition-colors active:scale-[0.99] ${compact ? 'min-h-9 px-3' : 'min-h-10 py-1.5 px-3'}`}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={18} className={iconColorClass}/> : <ChevronRight size={18} className="text-txt-muted"/>}
          <h3 className={`text-sm font-semibold flex items-center gap-2 tracking-tight ${titleColorClass}`}>
            <span className={iconColorClass}>{icon}</span> 
            {title} 
            <span className="text-xs font-mono font-normal text-txt-muted tabular-nums">{count}</span>
          </h3>
        </div>
        {actionButton}
      </div>
      
      {isOpen && (
         <div className={`dashboard-section-body ${highlight ? "animate-in fade-in slide-in-from-top-2 duration-300" : ""}`}>
            {children}
         </div>
      )}
    </div>
  );
};

export default DashboardSection;
