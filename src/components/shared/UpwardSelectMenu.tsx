import React from 'react';
import { Check } from 'lucide-react';

export interface UpwardSelectMenuOption<T extends string> {
  value: T;
  label: string;
}

export interface UpwardSelectMenuAnchor {
  bottom: number;
  left: number;
  width: number;
}

interface UpwardSelectMenuProps<T extends string> {
  anchor: UpwardSelectMenuAnchor;
  options: UpwardSelectMenuOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  listRef?: React.RefObject<HTMLDivElement>;
}

const UpwardSelectMenu = <T extends string>({
  anchor,
  options,
  selectedValue,
  onSelect,
  onClose,
  listRef
}: UpwardSelectMenuProps<T>) => {
  return (
    <>
      <div
        className="fixed inset-0 z-[60] pointer-events-auto"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        ref={listRef}
        className="fixed bg-surface-bg border border-surface-border rounded-xl shadow-ui-floating z-[70] overflow-hidden max-h-[50vh] overflow-y-auto no-scrollbar flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 pointer-events-auto"
        style={{
          bottom: `${anchor.bottom + 8}px`,
          left: `${anchor.left}px`,
          width: `${anchor.width}px`
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {options.map(option => {
          const isSelected = selectedValue === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={`w-full text-left px-3 py-2.5 text-xs font-bold border-b border-surface-border/50 last:border-0 hover:bg-surface-bg-alt flex items-center justify-between gap-2 ${
                isSelected ? 'text-brand-primary bg-brand-primary/10' : 'text-txt-primary'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {isSelected && <Check size={12} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default UpwardSelectMenu;
