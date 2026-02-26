
import React, { useMemo } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { Trophy } from 'lucide-react';
import ScoreCell from './ScoreCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedTotalCell from './TexturedTotalCell';
import TexturedBlock from './TexturedBlock';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { calculateWinners } from '../../../utils/templateUtils';
import { useSessionTranslation } from '../../../i18n/session';

interface ScreenshotLayout {
    itemWidth: number;
    playerWidths: Record<string, number>;
    playerHeaderHeight: number;
    rowHeights: Record<string, number>;
    totalRowHeight?: number;
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
    customWinners?: string[];
}

const TexturedScreenshotView: React.FC<ScreenshotViewProps> = (props) => {
    const { id, className, style, session, template, zoomLevel, mode, layout, baseImage, customWinners } = props;
    const { t } = useSessionTranslation();

    // Calculate Winners
    let winners: string[] = [];
    if (customWinners) {
        winners = customWinners;
    } else {
        const rule = session.scoringRule || 'HIGHEST_WINS';
        winners = calculateWinners(session.players, rule);
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
    const totalRowStyle = layout?.totalRowHeight ? { height: `${layout.totalRowHeight}px` } : {};

    // Group columns logic
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
    const visuals = template.globalVisuals || {};

    const leftRect = visuals.leftMaskRect;
    const topRect = visuals.topMaskRect;
    const rightRect = visuals.rightMaskRect;
    const bottomRect = visuals.bottomMaskRect;

    const X1 = leftRect?.width || 0;
    const Y1 = topRect?.height || 0;

    const W = topRect?.width || bottomRect?.width || (rightRect ? rightRect.x + rightRect.width : 1);
    const H = (bottomRect ? bottomRect.y + bottomRect.height : 0) || (leftRect ? leftRect.y + leftRect.height : 1);

    const X2 = rightRect ? rightRect.x : W;
    const Y2 = bottomRect ? bottomRect.y : H;

    const refW = template.globalVisuals?.playerLabelRect?.width || 1;
    const scale = refW > 0 ? itemColWidth / refW : 1;

    const scaledLeftW = X1 * scale;
    const scaledRightW = (W - X2) * scale;
    const scaledTopH = Y1 * scale;
    const scaledBottomH = (H - Y2) * scale;

    const rectTL = { x: 0, y: 0, width: X1, height: Y1 };
    const rectTC = { x: X1, y: 0, width: X2 - X1, height: Y1 };
    const rectTR = { x: X2, y: 0, width: W - X2, height: Y1 };

    const rectCL = leftRect;
    const rectCR = rightRect;

    const rectBL = { x: 0, y: Y2, width: X1, height: H - Y2 };
    const rectBC = { x: X1, y: Y2, width: X2 - X1, height: H - Y2 };
    const rectBR = { x: X2, y: Y2, width: W - X2, height: H - Y2 };

    const hasTextureFrame = scaledTopH > 0 || scaledBottomH > 0 || scaledLeftW > 0 || scaledRightW > 0;
    const showAppHeader = !(mode === 'simple' && baseImage);

    return (
        <div
            id={id}
            className={className + " bg-transparent"}
            style={{
                fontSize: `${16 * zoomLevel}px`,
                fontFamily: 'Inter, sans-serif',
                display: 'inline-flex',
                flexDirection: 'column',
                width: 'max-content',
                color: '#f8fafc',
                boxSizing: 'border-box',
                ...style
            }}
        >
            {showAppHeader && (
                <div id={`ss-header-${mode}`} className="p-4 flex items-center gap-2 bg-slate-900 rounded-none border-b border-slate-800 shadow-sm w-full box-border">
                    <div className={`p-2 rounded ${headerIconBoxClass}`}>
                        <Trophy className="text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{template.name}</h2>
                        <p className="text-slate-500 text-xs">{t('ss_app_title')} • {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            )}

            <div id={`screenshot-content-${mode}`} className="flex flex-col">
                {hasTextureFrame && scaledTopH > 0 && (
                    <div style={{ display: 'flex', height: scaledTopH }}>
                        <TexturedBlock baseImage={baseImage} rect={rectTL} style={{ width: scaledLeftW, flexShrink: 0 }} />
                        <TexturedBlock baseImage={baseImage} rect={rectTC} style={{ flex: 1, width: 'auto', aspectRatio: 'unset' } as any} />
                        <TexturedBlock baseImage={baseImage} rect={rectTR} style={{ width: scaledRightW, flexShrink: 0 }} />
                    </div>
                )}

                <div className="flex">
                    {hasTextureFrame && scaledLeftW > 0 && (
                        <div style={{ flexShrink: 0, width: `${scaledLeftW}px`, position: 'relative' }}>
                            <TexturedBlock baseImage={baseImage} rect={rectCL} style={{ width: '100%', height: '100%', aspectRatio: 'unset' } as any} />
                        </div>
                    )}

                    <div className="flex-1 flex flex-col">
                        <div id={`ss-player-header-row-${mode}`} className="flex items-stretch" style={playerHeaderRowStyle}>
                            <TexturedBlock
                                baseImage={baseImage}
                                rect={template.globalVisuals?.playerLabelRect}
                                fallbackContent={<span className="font-bold text-sm text-slate-400">{t('ss_player_label')}</span>}
                                className="flex items-center justify-center"
                                style={itemColStyle}
                            />

                            {session.players.map((p, index) => (
                                <TexturedPlayerHeader
                                    key={p.id}
                                    id={`ss-header-tex-${p.id}`}
                                    player={p}
                                    playerIndex={index}
                                    baseImage={baseImage || ''}
                                    rect={template.globalVisuals?.playerHeaderRect}
                                    onClick={() => { }}
                                    isEditing={false}
                                    className="flex flex-col items-center justify-center"
                                    style={{
                                        ...getPlayerColStyle(p.id),
                                        border: 'none',
                                    }}
                                    limitX={X2}
                                />
                            ))}
                        </div>

                        {processedColumns.map((col, index) => {
                            return (
                                <div
                                    key={col.id}
                                    id={`ss-row-${mode}-${col.id}`}
                                    className="flex"
                                    style={{ height: layout?.rowHeights[col.id] ? `${layout.rowHeights[col.id]}px` : undefined }}
                                >
                                    <TexturedBlock
                                        baseImage={baseImage}
                                        rect={col.visuals?.headerRect}
                                        className={`text-center flex flex-col justify-center`}
                                        style={{ ...itemColStyle }}
                                        fallbackContent={
                                            <div className="flex flex-col items-center justify-center w-full h-full p-2 border-r border-b border-slate-700 bg-slate-800">
                                                <span
                                                    className="text-sm font-bold text-slate-300 w-full leading-tight block break-words whitespace-pre-wrap"
                                                    style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}
                                                >
                                                    {col.name}
                                                </span>
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
                                                onClick={() => { }}
                                                screenshotMode={true}
                                                simpleMode={mode === 'simple'}
                                                baseImage={baseImage}
                                                forceHeight={"h-full"}
                                                limitX={X2}
                                                isAlt={false}
                                            />
                                        </div>
                                    ))}
                                </div>
                            );
                        })}

                        <div id={`ss-totals-row-${mode}`} className="flex items-stretch min-h-[2.5rem]" style={totalRowStyle}>
                            <TexturedBlock
                                baseImage={baseImage}
                                rect={template.globalVisuals?.totalLabelRect}
                                fallbackContent={<span className="font-black text-emerald-400 text-sm">{t('ss_total_label')}</span>}
                                className="flex items-center justify-center"
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
                                        borderTop: 'none',
                                    }}
                                    limitX={X2}
                                    cleanMode={mode === 'simple'}
                                />
                            ))}
                        </div>
                    </div>

                    {hasTextureFrame && scaledRightW > 0 && (
                        <div style={{ flexShrink: 0, width: `${scaledRightW}px`, position: 'relative' }}>
                            <TexturedBlock baseImage={baseImage} rect={rectCR} style={{ width: '100%', height: '100%', aspectRatio: 'unset' } as any} />
                        </div>
                    )}
                </div>

                {hasTextureFrame && scaledBottomH > 0 && (
                    <div style={{ display: 'flex', height: scaledBottomH }}>
                        <TexturedBlock baseImage={baseImage} rect={rectBL} style={{ width: scaledLeftW, flexShrink: 0 }} />
                        <TexturedBlock baseImage={baseImage} rect={rectBC} style={{ flex: 1, width: 'auto', aspectRatio: 'unset' } as any} />
                        <TexturedBlock baseImage={baseImage} rect={rectBR} style={{ width: scaledRightW, flexShrink: 0 }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TexturedScreenshotView;
