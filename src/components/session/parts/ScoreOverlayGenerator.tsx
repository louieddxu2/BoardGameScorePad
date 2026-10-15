import React, { forwardRef, useMemo } from 'react';
import { Player, ScoringRule } from '../../../types';
import { Crown } from 'lucide-react';
import StickerElement, { getPlayerStickerIndices } from './StickerElement';
import { useSessionTranslation } from '../../../i18n/session';
import { PHOTO_TITLE_FALLBACK } from '../../../utils/photoTitleContrast';
import { getPhotoPlayerNameShadow } from '../../../utils/photoTextContrast';

export interface OverlayData {
    gameName: string;
    date: number;
    endTime?: number;
    players: (Player & { isAnonymous?: boolean })[];
    winners: string[];
    scoringRule?: ScoringRule;
}

interface ScoreOverlayGeneratorProps {
    imageSrc: string;
    data: OverlayData;
}

const GENERATOR_WIDTH = 1080;
const PADDING_PX = 32;
const GAP_PX = 16;
const MAX_PLAYER_WIDTH = 220;

const ScoreOverlayGenerator = forwardRef<HTMLDivElement, ScoreOverlayGeneratorProps>(({ imageSrc, data }, ref) => {
    const displayTime = data.endTime ?? data.date;
    const { t, language } = useSessionTranslation();
    const stickerIndices = useMemo(() => getPlayerStickerIndices(data.players.map(player => player.id)), [data.players]);
    const scoringRule = data.scoringRule || 'HIGHEST_WINS';
    const isCoop = scoringRule === 'COOP' || scoringRule === 'COOP_NO_SCORE';
    // Legacy *_NO_SCORE identifiers mean no win/loss, not disabled score input.
    const hasNoOutcome = scoringRule === 'COOP_NO_SCORE' || scoringRule === 'COMPETITIVE_NO_SCORE';
    // The caller already applies cooperative rules (or supplies a recorded history result).
    // Do not recompute history outcomes or treat no-win/loss modes as missing results.
    const teamWon = scoringRule === 'COOP' && data.players.some(player => data.winners.includes(player.id));
    const teamLabel = teamWon ? t('screenshot_team_win') : t('screenshot_team_loss');
    const isScoredOutcomeMode = scoringRule === 'HIGHEST_WINS'
        || scoringRule === 'LOWEST_WINS';
    const showOutcomeForZeroScores = isScoredOutcomeMode
        && data.players.every(player => player.totalScore === 0);
    const dateStr = new Date(displayTime).toLocaleDateString(language, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date(displayTime).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: false });

    // Keep the existing balanced rows (e.g. five players use three columns).
    const numRows = Math.max(1, Math.ceil(data.players.length / 4));
    const targetCols = Math.max(1, Math.ceil(data.players.length / numRows));
    const innerWidth = GENERATOR_WIDTH - PADDING_PX * 2;
    const playerWidth = Math.min(MAX_PLAYER_WIDTH, Math.floor((innerWidth - (targetCols - 1) * GAP_PX) / targetCols));
    // Bound the whole group as well, so five compact cards still wrap as 3+2.
    const resultsWidth = targetCols * playerWidth + (targetCols - 1) * GAP_PX + PADDING_PX * 2;

    return (
        <div
            ref={ref}
            // Export typography must not inherit the user's rem-based UI zoom.
            style={{
                width: GENERATOR_WIDTH, fontSize: 16, lineHeight: 1.4,
                backgroundColor: 'var(--photo-result-background, rgb(var(--c-app-bg)))',
            }}
            className="bg-app-bg text-txt-primary flex flex-col items-stretch overflow-hidden"
        >
            <div className="bg-app-bg-deep relative">
                <img
                    data-score-photo-source="true"
                    src={imageSrc}
                    alt="Original"
                    crossOrigin="anonymous"
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                />
                <div
                    className="absolute pointer-events-none"
                    style={{ top: PADDING_PX, left: PADDING_PX, maxWidth: innerWidth * 0.8 }}
                >
                    <div
                        aria-hidden="true"
                        className="absolute"
                        style={{
                            inset: -24,
                            background: 'var(--photo-title-background, radial-gradient(ellipse at 30% 35%, rgba(0,0,0,0.5), transparent 80%))',
                        }}
                    />
                    <h2
                        data-score-photo-title="true"
                        className="relative font-black line-clamp-2"
                        style={{
                            margin: 0, fontSize: 44, lineHeight: 1.2, overflowWrap: 'anywhere',
                            // Leave room for the title's 2px outline inside the clipping box.
                            padding: 2,
                            color: 'var(--photo-title-color, #ffffff)',
                            textShadow: `var(--photo-title-shadow, ${PHOTO_TITLE_FALLBACK.shadow})`,
                        }}
                    >
                        {data.gameName}
                    </h2>
                </div>
            </div>

            {scoringRule === 'COOP' && data.players.length > 0 && (
                <div
                    data-score-photo-team={teamWon ? 'win' : 'loss'}
                    className="flex items-center justify-center font-bold text-txt-title"
                    style={{ alignSelf: 'center', padding: '20px 32px 0', gap: 8, fontSize: 32, lineHeight: 1.2 }}
                >
                    <span>{teamLabel}</span>
                    {teamWon && <Crown size={28} className="text-status-warning fill-current" style={{ alignSelf: 'flex-start' }} />}
                </div>
            )}

            <div
                data-score-photo-results="true"
                className="flex flex-wrap justify-center"
                style={{ width: resultsWidth, maxWidth: '100%', alignSelf: 'center', padding: `16px ${PADDING_PX}px`, gap: GAP_PX }}
            >
                {data.players.map(p => {
                    const isWinner = !hasNoOutcome && data.winners.includes(p.id);
                    const displayScore = showOutcomeForZeroScores
                        ? (isWinner ? t('screenshot_outcome_win') : t('screenshot_outcome_loss'))
                        : p.totalScore;
                    const playerColor = !p.color || p.color === 'transparent' ? 'rgb(var(--c-txt-secondary))' : p.color;
                    const scoreFontSize = Math.min(56, (playerWidth - 64) / (String(displayScore).length * 0.65));

                    return (
                        <div
                            key={p.id}
                            data-score-photo-player={p.id}
                            className="flex flex-col items-center justify-between bg-surface-bg border-2 border-surface-border"
                            style={{
                                width: playerWidth, minWidth: 0, borderRadius: 12, padding: '8px 12px 12px', gap: 6,
                                backgroundColor: 'var(--photo-result-card, rgb(var(--c-surface-bg)))',
                                borderColor: 'var(--photo-result-border, rgb(var(--c-surface-border)))',
                            }}
                        >
                            <div
                                data-score-photo-identity="true"
                                className="relative"
                                // Reserve space within the name box for its superscript crown.
                                style={{ maxWidth: '100%', minHeight: 50, padding: isCoop ? '10px 8px 0' : '10px 28px 0', textAlign: 'center' }}
                            >
                                {isWinner && !isCoop && (
                                    <Crown
                                        data-score-photo-winner="true"
                                        size={24}
                                        className="absolute text-status-warning fill-current"
                                        style={{ top: 0, right: 0 }}
                                    />
                                )}
                                {p.isAnonymous ? (
                                    <StickerElement id={p.id} color={playerColor} iconIndex={stickerIndices.get(p.id)}
                                        className="[&_svg]:w-[36px] [&_svg]:h-[36px]" />
                                ) : (
                                    <span
                                        className="font-bold"
                                        style={{
                                            display: 'block', fontSize: 32, lineHeight: 1.2, overflowWrap: 'anywhere',
                                            color: playerColor, textShadow: getPhotoPlayerNameShadow(playerColor),
                                        }}
                                    >
                                        {p.name}
                                    </span>
                                )}
                            </div>
                            <span
                                className="font-black font-mono text-txt-title"
                                style={{ fontSize: scoreFontSize, lineHeight: 1.05, whiteSpace: 'nowrap' }}
                            >
                                {displayScore}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div
                data-score-photo-metadata="true"
                className="border-t border-surface-border text-txt-secondary flex flex-wrap items-baseline justify-between"
                style={{ padding: `12px ${PADDING_PX}px`, gap: '8px 24px', fontSize: 24, lineHeight: 1.4 }}
            >
                <span className="font-mono">{dateStr} {timeStr}</span>
                <span style={{ marginLeft: 'auto', textAlign: 'right' }}>{t('ss_app_title')}</span>
            </div>
        </div>
    );
});

export default ScoreOverlayGenerator;
