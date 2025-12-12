import React from 'react';
import { ArrowRight, ArrowDown } from 'lucide-react';

interface InputPanelLayoutProps {
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
  onNext: () => void;
  nextButtonContent?: React.ReactNode;
  nextButtonDirection?: 'horizontal' | 'vertical';
  isCompact?: boolean; // New prop for focused mode
}

const InputPanelLayout: React.FC<InputPanelLayoutProps> = ({
  children,
  sidebarContent,
  onNext,
  nextButtonContent,
  nextButtonDirection = 'horizontal',
  isCompact = false,
}) => {
  
  const ButtonIcon = nextButtonDirection === 'horizontal' ? ArrowRight : ArrowDown;

  // Unified button logic to maintain exact visual consistency
  const renderNextButton = (mode: 'compact' | 'grid') => (
    <button
        // Prevent default on mouse down to keep input focus when clicking this button.
        // This allows us to remove the setTimeout in blur handlers.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onNext}
        className={`
            bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white 
            flex flex-col items-center justify-center 
            shadow-lg shadow-emerald-900/50 touch-manipulation transition-all active:scale-95 
            border-slate-800 relative
            ${mode === 'compact' 
                // Compact: Fixed height (h-14) to match input, full rounded corners, border
                ? 'w-[80px] h-14 shrink-0 rounded-xl border' 
                // Grid: Fills grid cell, specific rounded corners for sidebar connection
                : 'col-start-4 row-start-4 rounded-b-xl rounded-t-none border-l border-b border-r h-full w-full'
            }
        `}
    >
        {nextButtonContent ? nextButtonContent : <ButtonIcon size={24} />}
    </button>
  );

  // Compact Mode (Focused Input): Simple Flex Row
  if (isCompact) {
      return (
        <div className="flex items-start gap-2 p-2 bg-slate-900 select-none">
            {/* Main Content (Input) takes all space */}
            <div className="flex-1 min-w-0">
                {children}
            </div>
            {/* Identical button style, just different dimensions/rounding */}
            {renderNextButton('compact')}
        </div>
      );
  }

  // Full Mode: 4x4 Grid
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
      {renderNextButton('grid')}
    </div>
  );
};

export default InputPanelLayout;