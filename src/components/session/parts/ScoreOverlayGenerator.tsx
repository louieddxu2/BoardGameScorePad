import React, { forwardRef } from 'react';
import { Player, ScoringRule } from '../../../types';
import { Crown } from 'lucide-react';
import { ContrastText } from '../../shared/ContrastText';
import StickerElement from './StickerElement';
import { useSessionTranslation } from '../../../i18n/session';

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
    const scoringRule = data.scoringRule || 'HIGHEST_WINS';
    const isScoredOutcomeMode = scoringRule === 'HIGHEST_WINS'
        || scoringRule === 'LOWEST_WINS'
        || scoringRule === 'COOP';
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
            style={{ width: GENERATOR_WIDTH, fontSize: 16, lineHeight: 1.4 }}
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
                        className="relative font-black"
                        style={{
                            margin: 0, fontSize: 44, lineHeight: 1.2, overflowWrap: 'anywhere',
                            color: 'var(--photo-title-color, #ffffff)',
                            textShadow: 'var(--photo-title-shadow, 0 1px 3px rgba(0,0,0,0.45))',
                        }}
                    >
                        {data.gameName}
                    </h2>
                </div>
            </div>

            <div
                data-score-photo-results="true"
                className="flex flex-wrap justify-center"
                style={{ width: resultsWidth, maxWidth: '100%', alignSelf: 'center', padding: `16px ${PADDING_PX}px`, gap: GAP_PX }}
            >
                {data.players.map(p => {
                    const isWinner = data.winners.includes(p.id);
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
                            style={{ width: playerWidth, minWidth: 0, borderRadius: 12, padding: '8px 12px 12px', gap: 6 }}
                        >
                            <div
                                data-score-photo-identity="true"
                                className="relative"
                                // Reserve space within the name box for its superscript crown.
                                style={{ maxWidth: '100%', minHeight: 42, padding: '8px 24px 0', textAlign: 'center' }}
                            >
                                {isWinner && (
                                    <Crown
                                        data-score-photo-winner="true"
                                        size={20}
                                        className="absolute text-status-warning fill-current"
                                        style={{ top: 0, right: 0 }}
                                    />
                                )}
                                {p.isAnonymous ? (
                                    <StickerElement id={p.id} color={playerColor} className="[&_svg]:w-[30px] [&_svg]:h-[30px]" />
                                ) : (
                                    <ContrastText
                                        className="font-bold"
                                        color={playerColor}
                                        style={{ display: 'block', fontSize: 28, lineHeight: 1.2, overflowWrap: 'anywhere' }}
                                    >
                                        {p.name}
                                    </ContrastText>
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
