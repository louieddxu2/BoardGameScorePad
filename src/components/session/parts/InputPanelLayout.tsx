import React from 'react';
import { ArrowRight, ArrowDown } from 'lucide-react';

interface InputPanelLayoutProps {
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
  onNext: () => void;
  nextButtonContent?: React.ReactNode;
  nextButtonDirection?: 'horizontal' | 'vertical';
}

const InputPanelLayout: React.FC<InputPanelLayoutProps> = ({
  children,
  sidebarContent,
  onNext,
  nextButtonContent,
  nextButtonDirection = 'horizontal',
}) => {
  return (
    <div className="grid grid-cols-4 grid-rows-4 gap-2 p-2 select-none bg-slate-900 h-full">
      {/* Main content area (Left 3 columns, all 4 rows) */}
      <div className="col-span-3 row-span-4 h-full min-h-0">
        {children}
      </div>

      {/* Sidebar (Top 3 rows of the last column) */}
      <div className="col-start-4 row-start-1 row-span-3 overflow-hidden rounded-t-xl rounded-b-none bg-slate-800/20 border-l border-t border-r border-slate-800 min-h-0">
        {sidebarContent}
      </div>

      {/* Next button (Bottom row of the last column) */}
      <button
        onClick={onNext}
        className="col-start-4 row-start-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-b-xl rounded-t-none flex flex-col items-center justify-center shadow-lg shadow-emerald-900/50 touch-manipulation transition-all active:scale-95 relative border-l border-b border-r border-slate-800"
      >
        {nextButtonContent ? nextButtonContent : (
          nextButtonDirection === 'horizontal' ? <ArrowRight size={24} /> : <ArrowDown size={24} />
        )}
      </button>
    </div>
  );
};

export default InputPanelLayout;