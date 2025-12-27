
import React, { useEffect, useState, useMemo } from 'react';
import { GameSession, GameTemplate, ScoreColumn, Rect } from '../../../types';
import { Trophy } from 'lucide-react';
import ScoreCell from '../ScoreCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedTotalCell from './TexturedTotalCell';
import { cropImageToDataUrl } from '../../../utils/imageProcessing';
import { calculateColumnScore } from '../../../utils/scoring';
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
}

// --- Local Components for Texture Logic ---

const ScreenshotHeaderCell: React.FC<{ col: any; baseImage?: string; children?: React.ReactNode; className?: string; style?: React.CSSProperties }> = (props) => {
    const [bgUrl, setBgUrl] = useState<string | null>(null);
    useEffect(() => {
        let isMounted = true;
        if (props.baseImage && props.col.visuals?.headerRect) {
            cropImageToDataUrl(props.baseImage, props.col.visuals.headerRect).then(url => {
                if (isMounted) setBgUrl(url);
            });
        }
        return () => { isMounted = false; };
    }, [props.baseImage, props.col.visuals?.headerRect]);

    const style = { ...props.style };
    
    // Maintain Aspect Ratio if defined
    if (props.col.visuals?.headerRect) {
        const { width, height } = props.col.visuals.headerRect;
        if (width > 0 && height > 0) {
            (style as any).aspectRatio = `${width} / ${height}`;
        }
    }

    if (bgUrl) {
        style.backgroundImage = `url(${bgUrl})`;
        style.backgroundSize = '100% 100%';
        style.border = 'none';
    }

    return (
        <div className={props.className} style={style}>
            {bgUrl ? null : props.children}
        </div>
    );
};

const ScreenshotTotalLabel: React.FC<{ template: GameTemplate, baseImage?: string, className: string, style: React.CSSProperties }> = ({ template, baseImage, className, style }) => {
    const [bgUrl, setBgUrl] = useState<string | null>(null);
    useEffect(() => {
        let isMounted = true;
        if (baseImage && template.globalVisuals?.totalLabelRect) {
            cropImageToDataUrl(baseImage, template.globalVisuals.totalLabelRect).then(url => {
                if (isMounted) setBgUrl(url);
            });
        }
        return () => { isMounted = false; };
    }, [baseImage, template.globalVisuals?.totalLabelRect]);

    const finalStyle = { ...style };
    
    if (bgUrl) {
        finalStyle.backgroundImage = `url(${bgUrl})`;
        finalStyle.backgroundSize = '100% 100%';
        finalStyle.border = 'none';
        
        const rect = template.globalVisuals?.totalLabelRect;
        if (rect && rect.width > 0 && rect.height > 0) {
            (finalStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
        }
    }
    
    return (
        <div className={className} style={finalStyle}>
            {!bgUrl && <span className="font-black text-emerald-400 text-sm">總分</span>}
        </div>
    );
}

const ScreenshotPlayerLabelCorner: React.FC<{ template: GameTemplate, baseImage?: string, className: string, style: React.CSSProperties }> = ({ template, baseImage, className, style }) => {
    const [bgUrl, setBgUrl] = useState<string | null>(null);
    useEffect(() => {
        let isMounted = true;
        if (baseImage && template.globalVisuals?.playerLabelRect) {
            cropImageToDataUrl(baseImage, template.globalVisuals.playerLabelRect).then(url => {
                if (isMounted) setBgUrl(url);
            });
        }
        return () => { isMounted = false; };
    }, [baseImage, template.globalVisuals?.playerLabelRect]);

    const finalStyle = { ...style };
    
    if (bgUrl) {
        finalStyle.backgroundImage = `url(${bgUrl})`;
        finalStyle.backgroundSize = '100% 100%';
        finalStyle.border = 'none';

        const rect = template.globalVisuals?.playerLabelRect;
        if (rect && rect.width > 0 && rect.height > 0) {
            (finalStyle as any).aspectRatio = `${rect.width} / ${rect.height}`;
        }
    }

    return (
        <div className={className} style={finalStyle}>
            {!bgUrl && <span className="font-bold text-sm text-slate-400">玩家</span>}
        </div>
    );
}

// New: Texture Mask Reconstructor
const TextureMask: React.FC<{ rect?: Rect, baseImage?: string }> = ({ rect, baseImage }) => {
    const [bgUrl, setBgUrl] = useState<string | null>(null);
    useEffect(() => {
        if (baseImage && rect && rect.width > 0 && rect.height > 0) {
            cropImageToDataUrl(baseImage, rect).then(setBgUrl);
        }
    }, [baseImage, rect]);

    if (!rect || !bgUrl) return null;

    return (
        <div style={{ width: '100%', aspectRatio: `${rect.width} / ${rect.height}` }}>
            <img src={bgUrl} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
    );
};

const TextureSideMask: React.FC<{ rect?: Rect, baseImage?: string }> = ({ rect, baseImage }) => {
    const [bgUrl, setBgUrl] = useState<string | null>(null);
    useEffect(() => {
        if (baseImage && rect && rect.width > 0 && rect.height > 0) {
            cropImageToDataUrl(baseImage, rect).then(setBgUrl);
        }
    }, [baseImage, rect]);

    if (!rect || !bgUrl) return null;

    return (
        <div 
            style={{ 
                width: '100%', 
                height: '100%',
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat' 
            }} 
        />
    );
};

const formatDisplayNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '';
    if (Object.is(num, -0)) return '-0';
    return String(num);
};

// --- Main Component ---

const TexturedScreenshotView: React.FC<ScreenshotViewProps> = ({ session, template, zoomLevel, mode, layout, baseImage }) => {
  const winners = session.players
    .filter(p => p.totalScore === Math.max(...session.players.map(pl => pl.totalScore)))
    .map(p => p.id);

  const containerClass = 'bg-transparent';
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

  const topMask = template.globalVisuals?.topMaskRect;
  const bottomMask = template.globalVisuals?.bottomMaskRect;
  const leftMask = template.globalVisuals?.leftMaskRect;
  const rightMask = template.globalVisuals?.rightMaskRect;

  // We assume item column width is known from layout measurement
  // We approximate side mask widths based on aspect ratios relative to the Item Column
  // Base width for calculation is (itemColWidth) which corresponds to (playerLabelRect.width)
  
  const getSideMaskWidth = (maskRect: Rect | undefined) => {
      if (!maskRect || !template.globalVisuals?.playerLabelRect) return '0px';
      const referenceW = template.globalVisuals.playerLabelRect.width;
      if (referenceW <= 0) return '0px';
      const ratio = maskRect.width / referenceW;
      return `${ratio * itemColWidth}px`;
  };

  return (
    <div
      className={`${containerClass}`}
      style={{ 
        fontSize: `${16 * zoomLevel}px`,
        fontFamily: 'Inter, sans-serif',
        width: 'fit-content',
        color: '#f8fafc' // Default text color
      }}
    >
      {/* 
        Modified Header for Texture View:
        Removed `rounded-b-xl` and `mb-1` to prevent white gaps at corners when rendering on a white canvas background.
        Added `border-b` for separation.
      */}
      <div id={`ss-header-${mode}`} className="p-4 flex items-center gap-2 bg-slate-900 rounded-none border-b border-slate-800 shadow-sm">
        <div className={`p-2 rounded ${headerIconBoxClass}`}>
          <Trophy className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{template.name}</h2>
          <p className="text-slate-500 text-xs">萬用桌遊計分板 • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      <div id={`screenshot-content-${mode}`}>
        {/* ADD BACK TOP MASK */}
        <TextureMask rect={topMask} baseImage={baseImage} />

        <div className="flex">
            {/* ADD BACK LEFT MASK */}
            {leftMask && (
                <div style={{ flexShrink: 0, width: getSideMaskWidth(leftMask), position: 'relative' }}>
                    <TextureSideMask rect={leftMask} baseImage={baseImage} />
                </div>
            )}

            {/* Main Table Content */}
            <div className="flex-1">
                <div id={`ss-player-header-row-${mode}`} className="flex items-stretch" style={playerHeaderRowStyle}>
                <ScreenshotPlayerLabelCorner
                    template={template}
                    baseImage={baseImage}
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
                        // Pass right mask boundary for limit calculation
                        limitX={template.globalVisuals?.rightMaskRect?.x}
                    />
                ))}
                </div>

                {processedColumns.map(col => (
                    <div 
                        key={col.id} 
                        id={`ss-row-${mode}-${col.id}`} 
                        className="flex"
                        style={{ height: layout?.rowHeights[col.id] ? `${layout.rowHeights[col.id]}px` : undefined }}
                    >
                        <ScreenshotHeaderCell
                            col={col}
                            baseImage={baseImage}
                            className="p-2 text-center flex flex-col justify-center"
                            style={itemColStyle}
                        >
                        </ScreenshotHeaderCell>
                        
                        {session.players.map((p, index) => (
                        <div key={p.id} style={getPlayerColStyle(p.id)} className="relative">
                            <ScoreCell
                                player={p}
                                playerIndex={index}
                                column={col}
                                allColumns={template.columns}
                                isActive={false}
                                onClick={() => {}}
                                screenshotMode={true}
                                simpleMode={mode === 'simple'}
                                baseImage={baseImage}
                                forceHeight={"h-full"}
                                // Pass right mask boundary for limit calculation
                                limitX={template.globalVisuals?.rightMaskRect?.x}
                            />

                            {/* Render Overlays */}
                            {col.overlayColumns.map(overlayCol => {
                                const scoreData = p.scores[overlayCol.id];
                                const parts = scoreData?.parts || [];
                                const overlayContext = { allColumns: template.columns, playerScores: p.scores };
                                const displayScore = calculateColumnScore(overlayCol, parts, overlayContext);
                                
                                const hasInput = overlayCol.isAuto ? true : parts.length > 0;
                                const defaultTextColor = 'rgba(28, 35, 51, 0.90)';

                                const textStyle: React.CSSProperties = {
                                    color: hasInput ? (displayScore < 0 ? '#f87171' : (overlayCol.color || defaultTextColor)) : '#475569',
                                    ...(overlayCol.color && isColorDark(overlayCol.color) && { textShadow: ENHANCED_TEXT_SHADOW }),
                                    fontFamily: '"Kalam", "Caveat", cursive',
                                    transform: `rotate(${((p.id.charCodeAt(0) + overlayCol.id.charCodeAt(0)) % 5) - 2}deg)`,
                                    mixBlendMode: 'multiply',
                                    textShadow: 'none',
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
                )
                )}

                <div id={`ss-totals-row-${mode}`} className="flex items-stretch min-h-[2.5rem] bg-slate-900">
                    <ScreenshotTotalLabel 
                        template={template} 
                        baseImage={baseImage}
                        className="p-2 flex items-center justify-center"
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
                            className="flex items-center justify-center relative"
                            style={{ 
                                ...getPlayerColStyle(p.id),
                                border: 'none',
                            }}
                            hideCrown={true}
                            // Pass right mask boundary for limit calculation
                            limitX={template.globalVisuals?.rightMaskRect?.x}
                        />
                    ))}
                </div>
            </div>

            {/* ADD BACK RIGHT MASK */}
            {rightMask && (
                <div style={{ flexShrink: 0, width: getSideMaskWidth(rightMask), position: 'relative' }}>
                    <TextureSideMask rect={rightMask} baseImage={baseImage} />
                </div>
            )}
        </div>

        {/* ADD BACK BOTTOM MASK */}
        <TextureMask rect={bottomMask} baseImage={baseImage} />
      </div>
    </div>
  );
};

export default TexturedScreenshotView;
