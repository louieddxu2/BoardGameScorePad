
import React, { useMemo } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { Trophy } from 'lucide-react';
import ScoreCell from './ScoreCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedTotalCell from './TexturedTotalCell';
import TexturedBlock from './TexturedBlock';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

interface ScreenshotLayout {
  itemWidth: number;
  playerWidths: Record<string, number>;
  playerHeaderHeight: number;
  rowHeights: Record<string, number>;
}

interface ScreenshotViewProps {
  session: GameSession;
  template: GameTemplate;
  zoomLevel: number;
  mode: 'full' | 'simple';
  layout: ScreenshotLayout | null;
  baseImage?: string;
  customWinners?: string[]; 
}

const TexturedScreenshotView: React.FC<ScreenshotViewProps> = ({ session, template, zoomLevel, mode, layout, baseImage, customWinners }) => {
  // Calculate Winners
  let winners: string[] = [];
  if (customWinners) {
      winners = customWinners;
  } else {
      const rule = session.scoringRule || 'HIGHEST_WINS';
      if (rule === 'HIGHEST_WINS') {
          const maxScore = Math.max(...session.players.map(pl => pl.totalScore));
          winners = session.players.filter(p => p.totalScore === maxScore).map(p => p.id);
      } else if (rule === 'LOWEST_WINS') {
          const minScore = Math.min(...session.players.map(pl => pl.totalScore));
          winners = session.players.filter(p => p.totalScore === minScore).map(p => p.id);
      }
  }

  const headerIconBoxClass = 'bg-emerald-500/10 border border-emerald-500/20';

  const itemColWidth = layout ? layout.itemWidth : 70;
  const itemColStyle = { width: `${itemColWidth}px`, flexShrink: 0 };
  
  const getPlayerColStyle = (playerId: string) => {
    if (layout && layout.playerWidths[playerId]) {
      return { width: `${layout.playerWidths[playerId]}px`, flexShrink: 0 };
    }
    return { minWidth: '54px', flex: '1 1 0%' };
  };

  const playerHeaderRowStyle = layout?.playerHeaderHeight ? { height: `${layout.playerHeaderHeight}px` } : {};

  // Group columns logic (Same as ScoreGrid)
  const processedColumns = useMemo(() => {
    const getMode = (col: ScoreColumn) => col.displayMode || 'row';

    const visibleCols: (ScoreColumn & { overlayColumns: ScoreColumn[] })[] = [];
    const overlays: ScoreColumn[] = [];

    template.columns.forEach(col => {
      const mode = getMode(col);
      if (mode === 'row') {
        visibleCols.push({ ...col, overlayColumns: [] });
      } else if (mode === 'overlay') {
        overlays.push(col);
      }
      // Hidden columns are skipped
    });

    overlays.forEach(overlayCol => {
      const originalIndex = template.columns.findIndex(c => c.id === overlayCol.id);
      let host: (ScoreColumn & { overlayColumns: ScoreColumn[] }) | null = null;
      
      for (let i = originalIndex - 1; i >= 0; i--) {
        const potentialHostDef = template.columns[i];
        if (getMode(potentialHostDef) === 'row') {
          host = visibleCols.find(vc => vc.id === potentialHostDef.id) || null;
          break;
        }
      }
      
      if (host) {
        host.overlayColumns.push(overlayCol);
      }
    });

    return visibleCols;

  }, [template.columns]);

  // --- 9-Slice Grid Calculation ---
  const visuals = template.globalVisuals;
  
  // Safe defaults if visuals are missing
  const hasValidVisuals = visuals && visuals.leftMaskRect && visuals.rightMaskRect && visuals.topMaskRect && visuals.bottomMaskRect;

  // 1. Coordinates Extraction
  // We derive the 9-patch structure from the 4 Mask Rects.
  // Assumption: Masks cover the area OUTSIDE the grid.
  const X1 = hasValidVisuals ? visuals!.leftMaskRect!.width : 0;
  const Y1 = hasValidVisuals ? visuals!.topMaskRect!.height : 0;
  const X2 = hasValidVisuals ? visuals!.rightMaskRect!.x : 0;
  const Y2 = hasValidVisuals ? visuals!.bottomMaskRect!.y : 0;
  const W  = hasValidVisuals ? visuals!.topMaskRect!.width : 0;
  const H  = hasValidVisuals ? Y2 + visuals!.bottomMaskRect!.height : 0;

  // 2. Scale Ratio Calculation
  // We scale the masks to match the rendered HTML width of the "Player Label" column (usually 70px)
  // This ensures the resolution/density of the masks matches the content.
  const refW = template.globalVisuals?.playerLabelRect?.width || 1;
  const scale = refW > 0 ? itemColWidth / refW : 1;

  // 3. Render Dimensions
  const scaledLeftW = X1 * scale;
  const scaledRightW = (W - X2) * scale;
  const scaledTopH = Y1 * scale;
  const scaledBottomH = (H - Y2) * scale;

  // 4. Rect Definitions for 9-Patch (Corners & Edges)
  const rectTL = { x: 0, y: 0, width: X1, height: Y1 };
  const rectTC = { x: X1, y: 0, width: X2 - X1, height: Y1 };
  const rectTR = { x: X2, y: 0, width: W - X2, height: Y1 };

  const rectCL = visuals?.leftMaskRect;
  const rectCR = visuals?.rightMaskRect;

  const rectBL = { x: 0, y: Y2, width: X1, height: H - Y2 };
  const rectBC = { x: X1, y: Y2, width: X2 - X1, height: H - Y2 };
  const rectBR = { x: X2, y: Y2, width: W - X2, height: H - Y2 };

  return (
    <div
      className="bg-transparent"
      style={{ 
        fontSize: `${16 * zoomLevel}px`,
        fontFamily: 'Inter, sans-serif',
        display: 'inline-flex',
        flexDirection: 'column',
        width: 'max-content',
        color: '#f8fafc',
        boxSizing: 'border-box'
      }}
    >
      <div id={`ss-header-${mode}`} className="p-4 flex items-center gap-2 bg-slate-900 rounded-none border-b border-slate-800 shadow-sm w-full box-border">
        <div className={`p-2 rounded ${headerIconBoxClass}`}>
          <Trophy className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{template.name}</h2>
          <p className="text-slate-500 text-xs">萬用桌遊計分板 • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      {/* 9-Grid Layout Container */}
      <div id={`screenshot-content-${mode}`} className="flex flex-col">
        
        {/* ROW 1: TOP (Left Corner, Center, Right Corner) */}
        {hasValidVisuals && (
            <div style={{ display: 'flex', height: scaledTopH }}>
                <TexturedBlock baseImage={baseImage} rect={rectTL} style={{ width: scaledLeftW, flexShrink: 0 }} />
                <TexturedBlock baseImage={baseImage} rect={rectTC} style={{ flex: 1 }} />
                <TexturedBlock baseImage={baseImage} rect={rectTR} style={{ width: scaledRightW, flexShrink: 0 }} />
            </div>
        )}

        {/* ROW 2: CENTER (Left, CONTENT, Right) */}
        <div className="flex">
            {/* Left Edge */}
            {hasValidVisuals && (
                <div style={{ flexShrink: 0, width: `${scaledLeftW}px`, position: 'relative' }}>
                    <TexturedBlock baseImage={baseImage} rect={rectCL} style={{ width: '100%', height: '100%' }} />
                </div>
            )}

            {/* Main Content Grid */}
            <div className="flex-1 flex flex-col">
                <div id={`ss-player-header-row-${mode}`} className="flex items-stretch" style={playerHeaderRowStyle}>
                
                {/* Player Corner Label */}
                <TexturedBlock
                    baseImage={baseImage}
                    rect={template.globalVisuals?.playerLabelRect}
                    fallbackContent={<span className="font-bold text-sm text-slate-400">玩家</span>}
                    className="p-2 flex items-center justify-center" 
                    style={itemColStyle}
                />

                {session.players.map((p, index) => (
                    <TexturedPlayerHeader
                        key={p.id}
                        player={p}
                        playerIndex={index}
                        baseImage={baseImage || ''}
                        rect={template.globalVisuals?.playerHeaderRect}
                        onClick={() => {}}
                        isEditing={false}
                        className="p-2 flex flex-col items-center justify-center"
                        style={{ 
                            ...getPlayerColStyle(p.id),
                            border: 'none',
                        }}
                        limitX={template.globalVisuals?.rightMaskRect?.x}
                    />
                ))}
                </div>

                {processedColumns.map((col, index) => {
                    const isAlt = index % 2 !== 0;
                    const headerBgClass = isAlt ? 'bg-[#2e3b4e]' : 'bg-slate-800';
                    const getColumnBorderRight = (c: string | undefined) => (c || 'var(--border-slate-700)');

                    return (
                        <div 
                            key={col.id} 
                            id={`ss-row-${mode}-${col.id}`} 
                            className="flex"
                            style={{ height: layout?.rowHeights[col.id] ? `${layout.rowHeights[col.id]}px` : undefined }}
                        >
                            {/* Column Header */}
                            <TexturedBlock
                                baseImage={baseImage}
                                rect={col.visuals?.headerRect}
                                className={`p-2 text-center flex flex-col justify-center border-r border-b border-slate-700 ${headerBgClass}`}
                                style={{ ...itemColStyle, borderRightColor: getColumnBorderRight(col.color) }}
                                fallbackContent={
                                    <div className="flex flex-col items-center justify-center w-full h-full">
                                        <span 
                                            className="text-sm font-bold text-slate-300 w-full leading-tight block break-words whitespace-pre-wrap"
                                            style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}
                                        >
                                            {col.name}
                                        </span>
                                        {col.isScoring && (
                                            <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                                                {(() => {
                                                    if (col.formula.includes('a1×a2') && col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="">{col.subUnits[0]}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="">{col.subUnits[1]}</span></div>;
                                                    if (col.inputType === 'clicker' && !col.formula.includes('+next')) return <div className="flex items-center gap-1">{col.unit && <span className="text-xs">{col.unit}</span>}</div>;
                                                    if (col.formula?.includes('×c1')) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="">{col.unit}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="text-emerald-500 font-bold font-mono">{col.constants?.c1 ?? 1}</span></div>;
                                                    if (col.unit) return <span className="text-xs">{col.unit}</span>;
                                                    return null;
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                }
                            />
                            
                            {session.players.map((p, index) => (
                            <div key={p.id} style={getPlayerColStyle(p.id)} className="relative">
                                <ScoreCell
                                    player={p}
                                    playerIndex={index}
                                    column={col}
                                    allColumns={template.columns}
                                    allPlayers={session.players} 
                                    isActive={false}
                                    onClick={() => {}}
                                    screenshotMode={true}
                                    simpleMode={mode === 'simple'}
                                    baseImage={baseImage}
                                    forceHeight={"h-full"}
                                    limitX={template.globalVisuals?.rightMaskRect?.x}
                                    isAlt={isAlt}
                                />
                                
                                {col.overlayColumns.map(overlayCol => {
                                    if (!overlayCol.contentLayout) return null;
                                    return (
                                        <div
                                            key={overlayCol.id}
                                            className="absolute inset-0 z-10 pointer-events-none"
                                            style={{
                                                left: `${overlayCol.contentLayout.x}%`,
                                                top: `${overlayCol.contentLayout.y}%`,
                                                width: `${overlayCol.contentLayout.width}%`,
                                                height: `${overlayCol.contentLayout.height}%`,
                                            }}
                                        >
                                            <div className="w-full h-full">
                                                <ScoreCell
                                                    player={p}
                                                    playerIndex={index}
                                                    column={overlayCol}
                                                    allColumns={template.columns}
                                                    allPlayers={session.players}
                                                    isActive={false}
                                                    onClick={() => {}}
                                                    screenshotMode={true}
                                                    simpleMode={mode === 'simple'}
                                                    baseImage={baseImage}
                                                    forceHeight={"h-full"}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            ))}
                        </div>
                    );
                })}

                <div id={`ss-totals-row-${mode}`} className="flex items-stretch min-h-[2.5rem] bg-slate-900 border-t border-slate-700">
                    <TexturedBlock 
                        baseImage={baseImage}
                        rect={template.globalVisuals?.totalLabelRect}
                        fallbackContent={<span className="font-black text-emerald-400 text-sm">總分</span>}
                        className="p-2 flex items-center justify-center bg-slate-800 border-r border-slate-700"
                        style={itemColStyle}
                    />
                    {session.players.map((p, index) => (
                        <TexturedTotalCell
                            key={p.id}
                            player={p}
                            playerIndex={index}
                            isWinner={winners.includes(p.id)}
                            hasMultiplePlayers={session.players.length > 1}
                            baseImage={baseImage || ''}
                            rect={template.globalVisuals?.totalRowRect}
                            className="flex items-center justify-center relative border-r border-slate-700"
                            style={{ 
                                ...getPlayerColStyle(p.id),
                                borderRight: '1px solid rgb(51 65 85)', // explicit border needed for screenshot
                                borderTop: 'none',
                            }}
                            limitX={template.globalVisuals?.rightMaskRect?.x}
                        />
                    ))}
                </div>
            </div>

            {/* Right Edge */}
            {hasValidVisuals && (
                <div style={{ flexShrink: 0, width: `${scaledRightW}px`, position: 'relative' }}>
                    <TexturedBlock baseImage={baseImage} rect={rectCR} style={{ width: '100%', height: '100%' }} />
                </div>
            )}
        </div>

        {/* ROW 3: BOTTOM (Left Corner, Center, Right Corner) */}
        {hasValidVisuals && (
            <div style={{ display: 'flex', height: scaledBottomH }}>
                <TexturedBlock baseImage={baseImage} rect={rectBL} style={{ width: scaledLeftW, flexShrink: 0 }} />
                <TexturedBlock baseImage={baseImage} rect={rectBC} style={{ flex: 1 }} />
                <TexturedBlock baseImage={baseImage} rect={rectBR} style={{ width: scaledRightW, flexShrink: 0 }} />
            </div>
        )}
      </div>
    </div>
  );
};

export default TexturedScreenshotView;
