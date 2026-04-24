import React from 'react';
import { GameTemplate } from '../../types';
import { GripVertical, Download, Link2 } from 'lucide-react';
import { useTextureMapper } from './TextureMapperContext';
import { useTemplateEditorTranslation } from '../../i18n/template_editor';

interface MappingDrawerProps {
  template: GameTemplate;
  assignedIds: string[];
}

const MappingDrawer: React.FC<MappingDrawerProps> = ({ template, assignedIds }) => {
  const { setDraggedItem } = useTextureMapper();
  const { t } = useTemplateEditorTranslation();

  const handleDragInitiate = (e: React.MouseEvent | React.TouchEvent, colId: string) => {
    // Prevent default browser actions like text selection or scrolling
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDraggedItem({ colId: colId, x: clientX, y: clientY });
  };

  const renderItem = (colId: string) => {
    const col = template.columns.find(c => c.id === colId);
    if (!col) return null;

    const isAssigned = assignedIds.includes(colId);

    return (
      <div
        key={colId}
        className={`relative flex items-center gap-1.5 p-1.5 rounded-lg border transition-all h-10 select-none
                ${isAssigned
            ? 'modal-bg-recessed border-surface-border opacity-40'
            : 'modal-bg-elevated border-surface-border shadow-sm'
          }
            `}
      >
        {isAssigned && <Link2 size={12} className="shrink-0 text-brand-primary absolute left-1.5" />}
        <div className={`flex-1 min-w-0 transition-all ${isAssigned ? 'pl-5' : ''}`}>
          <span className={`text-sm font-medium truncate block ${isAssigned ? 'text-txt-muted' : 'text-txt-primary'}`}>{col.name}</span>
        </div>
        <div
          onMouseDown={(e) => handleDragInitiate(e, col.id)}
          onTouchStart={(e) => handleDragInitiate(e, col.id)}
          className="p-1 cursor-grab text-txt-muted hover:text-txt-primary hover:modal-bg-recessed rounded transition-colors touch-none"
        >
          <GripVertical size={16} className="shrink-0" />
        </div>
      </div>
    );
  };

  return (
    <div
      className="absolute top-4 left-4 bottom-4 w-28 modal-bg-elevated/70 backdrop-blur-md rounded-2xl border border-surface-border/50 z-40 flex flex-col shadow-2xl animate-in fade-in slide-in-from-left-4 duration-300"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="p-2 text-center text-xs font-bold text-txt-muted border-b border-surface-border shrink-0 flex items-center justify-center gap-1.5">
        <Download size={12} className="text-status-info shrink-0" />
        <span className="truncate">{t('mapper_source_label', { name: template.name })}</span>
      </div>
      <div
        id="mapping-drawer-list"
        className="flex-1 overflow-y-auto no-scrollbar p-1.5 space-y-1.5"
      >
        {template.columns.map((col) => renderItem(col.id))}
      </div>
    </div>
  );
};

export default MappingDrawer;