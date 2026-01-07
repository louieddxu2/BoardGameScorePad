
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GameTemplate } from '../../types';
import { ArrowLeft, Check, Settings2, Move, ZoomIn, ArrowRight, Plus, CopyPlus, GripVertical } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { getTouchDistance } from '../../utils/ui';
import { TextureMapperContext, DraggedItemInfo, ViewTransform, GridBounds } from './TextureMapperContext';
import GridPhase from './GridPhase';
import StructurePhase from './StructurePhase';
import ImportTemplateModal from './ImportTemplateModal';
import MappingDrawer from './MappingDrawer';
import { useTextureMapperInteractions } from './hooks/useTextureMapperInteractions';
import { buildTemplateFromTextureMap } from './utils/templateBuilder';

interface TextureMapperProps {
  imageSrc: string;
  initialName: string;
  initialColumnCount: number;
  onSave: (template: GameTemplate) => void;
  onCancel: () => void;
  allTemplates: GameTemplate[];
}

const DRAWER_BOUNDARY_X = 128; // w-28 (7rem=112px) + left-4 (1rem=16px)

const TextureMapper: React.FC<TextureMapperProps> = ({ imageSrc, initialName, initialColumnCount, onSave, onCancel, allTemplates }) => {
  // --- Core State ---
  // Default bounds: Top 0%, Bottom 100%, Left 0%, Right 100%
  const [gridBounds, setGridBounds] = useState<GridBounds>({ top: 0, bottom: 100, left: 0, right: 100 });
  const [hLines, setHLines] = useState<number[]>([]);
  const [vLines, setVLines] = useState<number[]>([25, 50]);
  const [headerSepIdx, setHeaderSepIdx] = useState<number>(1);
  const [totalSepIdx, setTotalSepIdx] = useState<number>(2);
  const [phase, setPhase] = useState<'grid' | 'structure'>('grid');
  const [activeLine, setActiveLine] = useState<{ type: 'h' | 'v' | 'bound', index: number, boundType?: 'top'|'bottom'|'left'|'right' } | null>(null);
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  
  // --- Mapping & Custom Drag State ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedTemplate, setImportedTemplate] = useState<GameTemplate | null>(null);
  const [rowMapping, setRowMapping] = useState<string[][]>([]);
  const [draggedItem, setDraggedItem] = useState<DraggedItemInfo | null>(null);
  const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);

  const dataColIdx = 1;
  const isMappingMode = !!importedTemplate;
  const rowCount = useMemo(() => Math.max(0, totalSepIdx - headerSepIdx), [headerSepIdx, totalSepIdx]);

  // --- Refs ---
  const isDraggingCanvas = useRef(false);
  const lastPanPoint = useRef<{ x: number, y: number } | null>(null);
  const startPinchDist = useRef<number>(0);
  const startPinchScale = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { showToast } = useToast();

  // Combine Bounds with internal lines for the logic
  const sortedHLines = useMemo(() => Array.from(new Set([gridBounds.top, ...hLines, gridBounds.bottom])).sort((a, b) => a - b), [hLines, gridBounds.top, gridBounds.bottom]);
  // vLines now constrained between left and right bounds
  const sortedVLines = useMemo(() => Array.from(new Set([gridBounds.left, ...vLines, gridBounds.right])).sort((a, b) => a - b), [vLines, gridBounds.left, gridBounds.right]);
  
  // --- Logic Effects ---
  useEffect(() => {
    // Initialize horizontal lines distributed within the default bounds (0-100)
    // When re-initializing, we distribute them evenly
    const totalRows = initialColumnCount + 2; 
    const rowHeight = 100 / totalRows;
    const initialHLines = Array.from({ length: initialColumnCount + 1 }, (_, i) => (i + 1) * rowHeight);
    setHLines(initialHLines);
    setTotalSepIdx(initialColumnCount + 1); 
  }, [initialColumnCount]);

  useEffect(() => {
    if (phase === 'grid') {
      const lastUserLineIdx = Math.max(1, sortedHLines.length - 2);
      setTotalSepIdx(lastUserLineIdx);
      if (headerSepIdx > lastUserLineIdx) {
        setHeaderSepIdx(1);
      }
    }
  }, [sortedHLines.length, phase, headerSepIdx]);

  useEffect(() => {
    if (importedTemplate) {
      setRowMapping(new Array(rowCount).fill(null).map(() => []));
    } else {
      setRowMapping([]);
    }
  }, [importedTemplate, rowCount]);

  const handleDropOnRow = (rowIndex: number, draggedColId: string) => {
    setRowMapping(currentMapping => {
      const newMapping = JSON.parse(JSON.stringify(currentMapping));
      for (let i = 0; i < newMapping.length; i++) {
        const indexInRow = newMapping[i].indexOf(draggedColId);
        if (indexInRow > -1) {
          newMapping[i].splice(indexInRow, 1);
          break; 
        }
      }
      if (rowIndex >= 0 && rowIndex < newMapping.length) {
        if (!Array.isArray(newMapping[rowIndex])) newMapping[rowIndex] = [];
        newMapping[rowIndex].push(draggedColId);
      }
      return newMapping;
    });
  };

  const handleClearRow = (rowIndex: number) => {
    setRowMapping(currentMapping => {
      const newMapping = [...currentMapping];
      if (rowIndex >= 0 && rowIndex < newMapping.length) newMapping[rowIndex] = [];
      return newMapping;
    });
  };

  const handleRemoveItemFromRow = (rowIndex: number, colIdToRemove: string) => {
    setRowMapping(currentMapping => {
        const newMapping = JSON.parse(JSON.stringify(currentMapping));
        if (newMapping[rowIndex]) {
            newMapping[rowIndex] = newMapping[rowIndex].filter((id: string) => id !== colIdToRemove);
        }
        return newMapping;
    });
  };

  const resetView = useCallback(() => {
    if (imgRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const imgW = imgRef.current.naturalWidth || 800;
      const imgH = imgRef.current.naturalHeight || 600;
      const scale = Math.min((rect.width - 100) / imgW, (rect.height - 100) / imgH);
      const x = (rect.width - imgW * scale) / 2;
      const y = (rect.height - imgH * scale) / 2;
      setTransform({ x, y, scale: scale || 1 });
    }
  }, []);

  useEffect(() => {
    if (imgRef.current) {
      const initFit = () => resetView();
      if (imgRef.current.complete) initFit();
      else imgRef.current.onload = initFit;
    }
  }, [resetView]);

  useTextureMapperInteractions({
    activeLine, transform, draggedItem, phase, isMappingMode, rowCount, headerSepIdx, sortedHLines, dropTargetRow,
    setActiveLine, setTransform, setHLines, setVLines, setDraggedItem, setDropTargetRow,
    handleDropOnRow,
    isDraggingCanvas, lastPanPoint, startPinchDist, startPinchScale,
    containerRef, contentRef,
    // New props for bounds
    gridBounds, setGridBounds
  });

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, type: 'bg' | 'line', payload?: any) => {
    e.stopPropagation();
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isTouch && (e as React.TouchEvent).touches.length === 2) {
      isDraggingCanvas.current = false;
      startPinchDist.current = getTouchDistance((e as React.TouchEvent).touches);
      startPinchScale.current = transform.scale;
      return;
    }
    if (type === 'line') setActiveLine(payload);
    else { isDraggingCanvas.current = true; lastPanPoint.current = { x: clientX, y: clientY }; }
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const scaleChange = -e.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(5, transform.scale * (1 + scaleChange)));
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const imgX = (mouseX - transform.x) / transform.scale;
      const imgY = (mouseY - transform.y) / transform.scale;
      const newTx = mouseX - (imgX * newScale);
      const newTy = mouseY - (imgY * newScale);
      setTransform({ x: newTx, y: newTy, scale: newScale });
    }
  };

  const addLine = (type: 'h') => {
    if (type === 'h') setHLines(prev => { 
        // 1. 取得所有參考線 (頂部邊界 + 內部線條)，排除底部邊界
        const refLines = [gridBounds.top, ...prev].sort((a, b) => a - b);
        
        let nextPos;

        if (refLines.length >= 2) {
            // 2. 抓取最後兩條線的間距
            const last = refLines[refLines.length - 1];
            const secondLast = refLines[refLines.length - 2];
            const gap = last - secondLast;
            
            // 3. 預測下一條線的位置
            nextPos = last + gap;
        } else {
            // 初始狀態 fallback
            nextPos = gridBounds.top + (gridBounds.bottom - gridBounds.top) / (initialColumnCount + 1);
        }

        // 4. 邊界檢查：若超出底部邊界，則改為取剩餘空間的一半
        if (nextPos >= gridBounds.bottom - 0.5) {
            const lastLine = refLines[refLines.length - 1];
            nextPos = lastLine + (gridBounds.bottom - lastLine) / 2;
        }

        // 確保數值有效
        if (Number.isNaN(nextPos) || nextPos <= gridBounds.top) {
             nextPos = (gridBounds.top + gridBounds.bottom) / 2;
        }

        return [...prev, nextPos].sort((a, b) => a - b); 
    });
  };
  const deleteLine = (type: 'h', index: number) => { 
      if (type === 'h') { 
          if (hLines.length <= 1) return; 
          setHLines(prev => prev.filter((_, i) => i !== index)); 
      } 
  };
  
  const handleSave = () => {
      if (!imgRef.current) return;
      
      const newTemplate = buildTemplateFromTextureMap(
          initialName, isMappingMode, importedTemplate, rowCount, rowMapping,
          headerSepIdx, totalSepIdx, dataColIdx, sortedHLines, sortedVLines,
          imgRef.current.naturalWidth, imgRef.current.naturalHeight,
          gridBounds // Pass bounds to builder
      );

      onSave(newTemplate);
      showToast({ title: "模板建立成功", message: "已套用計分紙紋理！", type: 'success' });
  };

  const contextValue = {
      hLines, setHLines, vLines, setVLines, sortedHLines, sortedVLines,
      gridBounds, setGridBounds, // Exposed
      headerSepIdx, setHeaderSepIdx, totalSepIdx, setTotalSepIdx,
      phase, setPhase,
      importedTemplate, setImportedTemplate, rowMapping, setRowMapping,
      rowCount, isMappingMode, transform,
      inverseScaleStyle: { transform: `scale(${1 / transform.scale})` },
      inverseScaleYStyle: { transform: `scaleY(${1 / transform.scale})` },
      inverseScaleXStyle: { transform: `scaleX(${1 / transform.scale})` },
      hLineChildStyle: { transform: `scale(${1 / transform.scale}, 1)` },
      vLineChildStyle: { transform: `translate(-50%, -50%) scale(1, ${1 / transform.scale})` },
      activeLine, setActiveLine,
      handlePointerDown: (e: React.MouseEvent | React.TouchEvent, type: 'line', payload?: any) => handlePointerDown(e, type, payload),
      addLine, deleteLine,
      handleDropOnRow,
      handleClearRow,
      handleRemoveItemFromRow,
      draggedItem, setDraggedItem,
      dropTargetRow, setDropTargetRow,
      allTemplates, showImportModal, setShowImportModal
  };

  return (
    <TextureMapperContext.Provider value={contextValue}>
      <div className="fixed inset-0 z-[80] bg-slate-950 flex flex-col overflow-hidden">
        {draggedItem && importedTemplate && (
            <div
                style={{
                    position: 'fixed',
                    top: draggedItem.y,
                    left: draggedItem.x,
                    transform: 'translate(-20px, -20px)',
                    pointerEvents: 'none',
                    zIndex: 9999,
                }}
            >
                <div className="w-28 flex items-center gap-1.5 p-1.5 rounded-lg border bg-slate-600 border-slate-500 shadow-lg">
                    <GripVertical size={12} className="shrink-0 text-slate-400" />
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-200 truncate block">
                            {importedTemplate.columns.find(c => c.id === draggedItem.colId)?.name}
                        </span>
                    </div>
                </div>
            </div>
        )}

        {showImportModal && <ImportTemplateModal allTemplates={allTemplates} onSelect={(t) => { setImportedTemplate(t); setShowImportModal(false); }} onClose={() => setShowImportModal(false)} />}
        <header className="flex-none bg-slate-900 border-b border-slate-800 p-2 flex items-center justify-between z-50 shadow-md">
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"><ArrowLeft size={20}/></button>
          <div className="flex-1 px-3 flex flex-col items-center justify-center overflow-hidden">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{phase === 'grid' ? '步驟 1/2 : 調整網格' : '步驟 2/2 : 定義結構'}</span>
            <p className="text-xs text-slate-300 text-center truncate w-full">{phase === 'grid' ? '拖曳四邊邊界裁切，再對齊內部線條。' : isMappingMode ? `從左側拖曳項目至右方橫列。` : '預覽項目分割，或點擊「匯入設定」套用規則。'}</p>
          </div>
          <div className="w-[36px] shrink-0"></div>
        </header>

        <main className="flex-1 relative bg-slate-900 overflow-hidden touch-none select-none" ref={containerRef} onMouseDown={(e) => handlePointerDown(e, 'bg')} onTouchStart={(e) => handlePointerDown(e, 'bg')} onWheel={handleWheel}>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur text-white text-xs rounded-full pointer-events-none flex items-center gap-2 z-40 opacity-70">
            <Move size={12} /> 單指平移 • 雙指縮放 • 拖曳線條
          </div>
          
          {phase === 'structure' && isMappingMode && importedTemplate && (
            <MappingDrawer
              template={importedTemplate}
              assignedIds={rowMapping.flat()}
            />
          )}

          <div ref={contentRef} className="absolute top-0 left-0 origin-top-left will-change-transform" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: imgRef.current?.naturalWidth, height: imgRef.current?.naturalHeight }}>
            <img ref={imgRef} src={imageSrc} className="block pointer-events-none select-none shadow-2xl" draggable={false} alt="Template Source" />
            {phase === 'grid' ? <GridPhase /> : <StructurePhase />}
          </div>
        </main>

        <footer className="flex-none p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-50">
          {phase === 'grid' ? (
            <>
              <div className="flex items-center gap-4">
                <button onClick={resetView} className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"><div className="p-3 rounded-xl bg-slate-800"><ZoomIn size={20} /></div>重置視角</button>
                <button onClick={(e) => { e.stopPropagation(); addLine('h'); }} className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"><div className="p-3 rounded-xl bg-slate-800"><Plus size={20} /></div>新增橫列 ({hLines.length}欄)</button>
              </div>
              <button onClick={() => setPhase('structure')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2">下一步 <ArrowRight size={16} /></button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {!isMappingMode ? (
                  <button onClick={() => setPhase('grid')} className="bg-slate-800 text-slate-300 px-4 py-3 rounded-lg text-sm font-bold shadow flex items-center gap-2 border border-slate-700"><Settings2 size={16} /> 返回網格</button>
                ) : (
                  <button onClick={() => setImportedTemplate(null)} className="bg-slate-800 text-slate-300 px-4 py-3 rounded-lg text-sm font-bold shadow flex items-center gap-2 border border-slate-700"><CopyPlus size={16} /> 取消匯入</button>
                )}
                <button onClick={() => setShowImportModal(true)} className="bg-sky-800 text-sky-300 px-4 py-3 rounded-lg text-sm font-bold shadow flex items-center gap-2 border border-sky-700"><CopyPlus size={16} /> 匯入設定</button>
              </div>
              <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2"><Check size={18} /> 完成</button>
            </>
          )}
        </footer>
      </div>
    </TextureMapperContext.Provider>
  );
};

export default TextureMapper;
