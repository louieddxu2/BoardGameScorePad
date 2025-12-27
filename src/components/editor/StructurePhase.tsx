import React from 'react';
import { useTextureMapper } from './TextureMapperContext';
import { Trash2, X } from 'lucide-react';

const StructurePhase: React.FC = () => {
  const {
    isMappingMode,
    importedTemplate,
    rowCount,
    rowMapping,
    sortedHLines,
    headerSepIdx,
    totalSepIdx,
    inverseScaleStyle,
    vLines,
    handleClearRow,
    handleRemoveItemFromRow,
    dropTargetRow,
    inverseScaleYStyle,
    transform,
  } = useTextureMapper();

  return (
    <>
      {/* Horizontal Grid Lines */}
      <div className="absolute inset-0 pointer-events-none">
        {sortedHLines.map((y, i) => {
          // Don't draw the very first and very last lines as they are the image borders
          if (i === 0 || i === sortedHLines.length - 1) return null;
          return (
            <div
              key={`h-line-struct-${i}`}
              className="absolute left-0 right-0 h-[2px] bg-sky-400/80 z-10"
              style={{ top: `${y}%`, ...inverseScaleYStyle }}
            />
          );
        })}
      </div>

      {/* Structure Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Player & Total areas */}
        <div className="absolute left-0 right-0 top-0 bg-black/60 flex items-center justify-center" style={{ height: `${sortedHLines[headerSepIdx]}%` }}>
          <span className="text-white/70 font-bold tracking-widest uppercase origin-center bg-black/50 px-2 rounded" style={inverseScaleStyle}>玩家名稱</span>
        </div>
        <div className="absolute left-0 right-0 bottom-0 bg-yellow-900/50 flex items-center justify-center" style={{ top: `${sortedHLines[totalSepIdx]}%` }}>
          <span className="text-yellow-400 font-bold tracking-widest uppercase origin-center bg-black/50 px-2 rounded" style={inverseScaleStyle}>總分合計</span>
        </div>
      </div>
      
      {/* Drop Zones & Mapping Previews */}
      {isMappingMode && importedTemplate && (
        <div className="absolute inset-0 pointer-events-auto">
          {Array.from({ length: rowCount }).map((_, i) => {
            const rowIdx = headerSepIdx + i;
            const top = sortedHLines[rowIdx];
            const height = sortedHLines[rowIdx + 1] - top;
            const colIds = rowMapping[i] || [];
            const hasItems = colIds.length > 0;
            const isHighlighted = dropTargetRow === i;

            return (
              <div 
                key={`drop-zone-${i}`}
                className="absolute left-0 right-0 group"
                style={{
                    top: `${top}%`,
                    height: `${height}%`,
                }}
              >
                {/* Drop Highlight Indicator */}
                {isHighlighted && (
                  <div className="absolute inset-0 bg-emerald-500/30 border-2 border-dashed border-emerald-400 pointer-events-none animate-in fade-in duration-100" />
                )}
                
                {/* CONDITIONAL RENDER: Items vs Empty state */}
                {hasItems ? (
                  // Item Preview Container - full width with scrolling
                  <div className="absolute left-0 right-0 top-0 bottom-0 pointer-events-auto overflow-x-auto no-scrollbar">
                    <div className="inline-flex h-full items-center gap-1 p-1">
                      {colIds.map(colId => {
                        const sourceCol = importedTemplate.columns.find(c => c.id === colId);
                        if (!sourceCol) return null;
                        return (
                          <div 
                            key={colId}
                            className="relative inline-flex items-center pr-5 pl-1.5 py-0.5 bg-slate-100/40 backdrop-blur-sm rounded border border-slate-200/50 shadow-lg group/item"
                            style={{ ...inverseScaleStyle, transformOrigin: 'center', fontSize: '10px' }}
                          >
                            <span className="font-bold text-slate-900 truncate" style={{textShadow: '0 1px 1px rgba(255,255,255,0.5)'}}>{sourceCol.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveItemFromRow(i, colId); }}
                              className="absolute top-1/2 right-0.5 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-700/60 hover:bg-red-600/80 text-slate-200 hover:text-white flex items-center justify-center transition-colors pointer-events-auto"
                            >
                              <X size={8} strokeWidth={3} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Empty State Container - constrained to first column
                  <div 
                    className="absolute left-0 top-0 bottom-0 pointer-events-none"
                    style={{ width: `${vLines[0]}%` }}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                        <div 
                          className="inline-flex items-center px-2 py-1 bg-slate-800/50 backdrop-blur-sm rounded-md border border-dashed border-slate-500/50"
                          style={{ ...inverseScaleStyle, transformOrigin: 'center', fontSize: '10px' }}
                        >
                          <span className="font-bold text-slate-400 italic">空</span>
                        </div>
                    </div>
                  </div>
                )}

                {/* Clear Row Button */}
                {hasItems && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearRow(i);
                    }}
                    className="absolute right-[100%] mr-2 top-1/2 z-10 p-1.5 bg-slate-200/30 hover:bg-red-500/50 backdrop-blur-sm border border-white/20 text-red-100 hover:text-white rounded-full transition-all opacity-50 group-hover:opacity-100"
                    style={{
                      transform: `translateY(-50%) scale(${1 / transform.scale})`,
                      transformOrigin: 'center'
                    }}
                    title={`清空此列`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default StructurePhase;