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
            bg-status-success hover:opacity-90 active:opacity-80 text-white 
            flex flex-col items-center justify-center 
            shadow-lg shadow-status-success/20 touch-manipulation transition-all active:scale-95 
            border-[rgb(var(--c-input-border))] relative
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

  // Compact Mode (Focused Input): Explicit rows to prevent squashing
  if (isCompact) {
      return (
        <div className="grid grid-cols-4 grid-rows-[1fr_56px] gap-2 p-2 select-none bg-[rgb(var(--c-input-bg))] h-full">
            {/* Main content area (Left 3 columns, both rows) */}
            <div className="col-span-3 row-span-2 h-full min-h-0">
                {children}
            </div>

            {/* Sidebar (top area of last column - row 1) */}
            <div className="col-start-4 row-start-1 overflow-hidden rounded-t-xl bg-[rgb(var(--c-input-header-bg)/0.3)] border-l border-t border-r border-[rgb(var(--c-input-border))] min-h-0">
                {sidebarContent}
            </div>

            {/* Next button (bottom area of last column - row 2) */}
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onNext}
                className="col-start-4 row-start-2 bg-status-success hover:opacity-90 active:opacity-80 text-white flex flex-col items-center justify-center shadow-lg shadow-status-success/20 touch-manipulation transition-all active:scale-95 border-l border-b border-r border-[rgb(var(--c-input-border))] rounded-b-xl rounded-t-none h-[56px] w-full relative"
            >
                {nextButtonContent ? nextButtonContent : <ButtonIcon size={24} />}
            </button>
        </div>
      );
  }

  // Full Mode: 4x4 Grid
  return (
    <div className="grid grid-cols-4 grid-rows-4 gap-2 p-2 select-none bg-[rgb(var(--c-input-bg))] h-full">
      {/* Main content area (Left 3 columns, all 4 rows) */}
      <div className="col-span-3 row-span-4 h-full min-h-0">
        {children}
      </div>

      {/* Sidebar (Top 3 rows of the last column) */}
      <div className="col-start-4 row-start-1 row-span-3 overflow-hidden rounded-t-xl rounded-b-none bg-[rgb(var(--c-input-header-bg)/0.3)] border-l border-t border-r border-[rgb(var(--c-input-border))] min-h-0">
        {sidebarContent}
      </div>

      {/* Next button (Bottom row of the last column) */}
      {renderNextButton('grid')}
    </div>
  );
};

export default InputPanelLayout;