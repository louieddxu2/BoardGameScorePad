
import React, { useMemo } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { Trophy } from 'lucide-react';
import ScoreCell from './ScoreCell';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedTotalCell from './TexturedTotalCell';
import { cropImageToDataUrl } from '../../../utils/imageProcessing';
import TexturedScreenshotView from './TexturedScreenshotView';
import { calculateColumnScore } from '../../../utils/scoring';

interface ScreenshotLayout {
  itemWidth: number;
  playerWidths: Record<string, number>;
  playerHeaderHeight: number;
  rowHeights: Record<string, number>;
}

interface ScreenshotViewProps {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  session: GameSession;
  template: GameTemplate;
  zoomLevel: number;
  mode: 'full' | 'simple';
  layout: ScreenshotLayout | null;
  baseImage?: string;
  customWinners?: string[]; // New Prop
}

const ScreenshotHeaderCell: React.FC<{ col: any; baseImage?: string; children?: React.ReactNode; className?: string; style?: React.CSSProperties }> = (props) => {
    const style = { ...props.style };

    return (
        <div className={props.className} style={style}>
            <div className="flex flex-col items-center justify-center w-full h-full">
                <span 
                    className="text-sm font-bold text-slate-300 w-full leading-tight" 
                    style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    display: 'block',
                    ...(props.col.color && { color: props.col.color, ...(isColorDark(props.col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) 
                    }}
                >
                    {props.col.name}
                </span>
                {props.col.isScoring && (
                    <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                        {(() => {
                            if (props.col.formula.includes('a1×a2') && props.col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="">{props.col.subUnits[0]}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="">{props.col.subUnits[1]}</span></div>;
                            if (props.col.inputType === 'clicker' && !props.col.formula.includes('+next')) return <div className="flex items-center gap-1">{props.col.unit && <span className="text-xs">{props.col.unit}</span>}</div>;
                            
                            // Check for any formula involving multiplication by c1 (e.g. a1xc1, (a1+next)xc1)
                            if (props.col.formula?.includes('×c1')) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="">{props.col.unit}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="text-emerald-500 font-bold font-mono">{props.col.constants?.c1 ?? 1}</span></div>;
                            
                            if (props.col.unit) return <span className="text-xs">{props.col.unit}</span>;
                            return null;
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

const ScreenshotTotalLabel: React.FC<{ template: GameTemplate, baseImage?: string, className: string, style: React.CSSProperties }> = ({ template, baseImage, className, style }) => {
    const [bgUrl, setBgUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (baseImage && template.globalVisuals?.totalLabelRect) {
            cropImageToDataUrl(baseImage, template.globalVisuals.totalLabelRect).then(setBgUrl);
        } else {
            setBgUrl(null);
        }
    }, [baseImage, template.globalVisuals?.totalLabelRect]);

    const finalStyle = { ...style };
    const hasTexture = !!(baseImage && template.globalVisuals?.totalLabelRect);
    
    if (hasTexture) {
        if (bgUrl) {
            finalStyle.backgroundImage = `url(${bgUrl})`;
            finalStyle.backgroundSize = '100% 100%';
        }
        finalStyle.border = 'none';
        
        const rect = template.globalVisuals?.totalLabelRect;
        if (rect && rect.width > 0 && rect.height > 0) {
            (finalStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
        }
    }
    
    return (
        <div className={className} style={finalStyle}>
            {!hasTexture && <span className="font-black text-emerald-400 text-sm">總分</span>}
        </div>
    );
}

const ScreenshotPlayerLabelCorner: React.FC<{ template: GameTemplate, baseImage?: string, className: string, style: React.CSSProperties }> = ({ template, baseImage, className, style }) => {
    const [bgUrl, setBgUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (baseImage && template.globalVisuals?.playerLabelRect) {
            cropImageToDataUrl(baseImage, template.globalVisuals.playerLabelRect).then(setBgUrl);
        } else {
            setBgUrl(null);
        }
    }, [baseImage, template.globalVisuals?.playerLabelRect]);

    const finalStyle = { ...style };
    const hasTexture = !!(baseImage && template.globalVisuals?.playerLabelRect);
    
    if (hasTexture) {
        if (bgUrl) {
            finalStyle.backgroundImage = `url(${bgUrl})`;
            finalStyle.backgroundSize = '100% 100%';
        }
        finalStyle.border = 'none';

        const rect = template.globalVisuals?.playerLabelRect;
        if (rect && rect.width > 0 && rect.height > 0) {
            (finalStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
        }
    }

    return (
        <div className={className} style={finalStyle}>
            {!hasTexture && <span className="font-bold text-sm text-slate-400">玩家</span>}
        </div>
    );
}

const formatDisplayNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '';
    if (Number.isNaN(num)) return 'NaN';
    if (num === Infinity) return '∞';
    if (num === -Infinity) return '-∞';
    if (Object.is(num, -0)) return '-0';
    return String(num);
};

const ScreenshotView: React.FC<ScreenshotViewProps> = (props) => {
  const { id, className, style, session, template, zoomLevel, mode, layout, baseImage, customWinners } = props;

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
      // Hidden columns are implicitly skipped from visibleCols
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

  if (baseImage) {
    return (
        <div id={id} className={className} style={style}>
            <TexturedScreenshotView {...props} />
        </div>
    );
  }

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

  const containerClass = 'bg-slate-900';
  const headerIconBoxClass = 'bg-emerald-500/10 border border-emerald-500/20';
  const getColumnBorderRight = (color: string | undefined) => (color || 'var(--border-slate-700)');
  
  const rowBorderClass = 'border-slate-700';
  const borderRightClass = 'border-r';
  const borderBottomClass = 'border-b';
  const borderRight2Class = 'border-r-2';
  const rowBgClass = 'bg-slate-800';

  const itemColWidth = layout ? layout.itemWidth : 70;
  const itemColStyle = { width: `${itemColWidth}px`, flexShrink: 0 };
  
  const getPlayerColStyle = (playerId: string) => {
    if (layout && layout.playerWidths[playerId]) {
      return { width: `${layout.playerWidths[playerId]}px`, flexShrink: 0 };
    }
    return { minWidth: '54px', flex: '1 1 0%' };
  };

  const playerHeaderRowStyle = layout?.playerHeaderHeight ? { height: `${layout.playerHeaderHeight}px` } : {};

  return (
    <div
      id={id}
      className={`text-slate-100 ${containerClass} ${className || ''}`}
      style={{ 
        fontSize: `${16 * zoomLevel}px`,
        fontFamily: 'Inter, sans-serif',
        width: 'fit-content',
        ...style
      }}
    >
      <div id={`ss-header-${mode}`} className="p-4 flex items-center gap-2 bg-slate-900 rounded-b-xl mb-1 shadow-sm">
        <div className={`p-2 rounded ${headerIconBoxClass}`}>
          <Trophy className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{template.name}</h2>
          <p className="text-slate-500 text-xs">萬用桌遊計分板 • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      <div id={`screenshot-content-${mode}`}>
        <div id={`ss-player-header-row-${mode}`} className={`flex items-stretch ${borderBottomClass} ${rowBorderClass} ${rowBgClass}`} style={playerHeaderRowStyle}>
          <ScreenshotPlayerLabelCorner
             template={template}
             className={`${borderRightClass} ${rowBorderClass} p-2 flex items-center justify-center`} 
             style={itemColStyle}
          />
          {session.players.map((p, index) => (
            <TexturedPlayerHeader
                key={p.id}
                player={p}
                playerIndex={index}
                baseImage={''} 
                onClick={() => {}}
                isEditing={false}
                className={`${borderRightClass} ${rowBorderClass} p-2 flex flex-col items-center justify-center`}
                style={getPlayerColStyle(p.id)}
            />
          ))}
        </div>

        {processedColumns.map((col, index) => {
            const isAlt = index % 2 !== 0;
            const headerBgClass = isAlt ? 'bg-[#2e3b4e]' : 'bg-slate-800';

            return (
                <div 
                    key={col.id} 
                    id={`ss-row-${mode}-${col.id}`} 
                    className="flex"
                    style={{ height: layout?.rowHeights[col.id] ? `${layout.rowHeights[col.id]}px` : undefined }}
                >
                    <ScreenshotHeaderCell
                        col={col}
                        className={`${borderRight2Class} ${borderBottomClass} ${rowBorderClass} p-2 text-center flex flex-col justify-center ${headerBgClass}`}
                        style={{ ...itemColStyle, borderRightColor: getColumnBorderRight(col.color) }}
                    >
                    </ScreenshotHeaderCell>
                    
                    {session.players.map((p, index) => (
                    <div key={p.id} style={getPlayerColStyle(p.id)} className="relative">
                        <ScoreCell
                            player={p}
                            playerIndex={index}
                            column={col}
                            allColumns={template.columns}
                            allPlayers={session.players} // Pass session players
                            isActive={false}
                            onClick={() => {}}
                            screenshotMode={true}
                            simpleMode={mode === 'simple'}
                            baseImage={undefined}
                            forceHeight={"h-full"}
                            isAlt={isAlt}
                        />
                        
                        {/* Render Overlays */}
                        {col.overlayColumns.map(overlayCol => {
                            const scoreData = p.scores[overlayCol.id];
                            const parts = scoreData?.parts || [];
                            const overlayContext = { 
                                allColumns: template.columns, 
                                playerScores: p.scores,
                                allPlayers: session.players // Pass session players
                            };
                            const displayScore = calculateColumnScore(overlayCol, parts, overlayContext);
                            
                            const hasInput = overlayCol.isAuto ? true : parts.length > 0;
                            const defaultTextColor = '#ffffff';

                            const textStyle: React.CSSProperties = {
                                color: hasInput ? (displayScore < 0 ? '#f87171' : (overlayCol.color || defaultTextColor)) : '#475569',
                                ...(overlayCol.color && isColorDark(overlayCol.color) && { textShadow: ENHANCED_TEXT_SHADOW }),
                            };

                            if (!overlayCol.contentLayout) return null;

                            return (
                                <div
                                    key={overlayCol.id}
                                    className="absolute flex items-center justify-center pointer-events-none"
                                    style={{
                                        left: `${overlayCol.contentLayout.x}%`,
                                        top: `${overlayCol.contentLayout.y}%`,
                                        width: `${overlayCol.contentLayout.width}%`,
                                        height: `${overlayCol.contentLayout.height}%`,
                                    }}
                                >
                                    <span className="text-xl font-bold tracking-tight w-full text-center truncate px-1" style={textStyle}>
                                        {hasInput ? formatDisplayNumber(displayScore) : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    ))}
                </div>
            );
        })}

        <div id={`ss-totals-row-${mode}`} className={`flex items-stretch min-h-[2.5rem] border-t ${rowBorderClass} bg-slate-900`}>
            <ScreenshotTotalLabel 
                template={template}
                className={`${borderRightClass} ${rowBorderClass} p-2 flex items-center justify-center bg-slate-800`}
                style={itemColStyle}
            />
            {session.players.map((p, index) => (
                <TexturedTotalCell
                    key={p.id}
                    player={p}
                    playerIndex={index}
                    isWinner={winners.includes(p.id)}
                    hasMultiplePlayers={session.players.length > 1}
                    baseImage={''}
                    className={`${borderRightClass} ${rowBorderClass} flex items-center justify-center relative`}
                    style={getPlayerColStyle(p.id)}
                />
            ))}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotView;
