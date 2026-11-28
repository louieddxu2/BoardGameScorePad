import React, { memo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Crown, X } from 'lucide-react';
import type { Player, ScoreColumn, ScoringRule } from '../../../types';
import { useSessionTranslation } from '../../../i18n/session';
import { useCommonTranslation } from '../../../i18n/common';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { formatDisplayNumber } from '../../../utils/scoreDisplay';
import { createColorReader, type ColorReader } from '../../../utils/color';
import { getQuickActionTextStyles } from '../../../utils/quickActionColors';
import { calculateWinners } from '../../../utils/templateUtils';
import { ContrastText } from '../../shared/ContrastText';
import { getScoreDisplayStandings } from '../scoreDisplayStandings';
import { getPhotoItemRows, type PhotoItemValue } from '../parts/photoPlayerItems';
import './ScoreDisplayModal.css';

interface ScoreDisplayBoardProps {
  gameName: string;
  players: Player[];
  columns: ScoreColumn[];
  scoringRule?: ScoringRule;
}

interface ScoreDisplayModalProps extends ScoreDisplayBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

const CARD_SURFACE = 'rgb(var(--c-surface-bg))';
const BOARD_SURFACE = 'rgb(var(--c-app-bg))';

function renderPhotoLabels(
  items: { id: string; value?: PhotoItemValue }[], backdrop: string, read: ColorReader,
) {
  const labels = items.flatMap(({ id, value }) =>
    value && 'labels' in value ? value.labels
      .filter(label => label.text.trim())
      .map(label => (
        <span key={`${id}:${label.id}`} style={{
          backgroundColor: label.color,
          ...getQuickActionTextStyles(label.color, backdrop, read),
        }}>
          {label.text}
        </span>
      )) : [],
  );
  return labels.length > 0 && <div className="score-display-labels">{labels}</div>;
}

const ScoreDisplayBoard = memo(function ScoreDisplayBoard({ gameName, players, columns, scoringRule }: ScoreDisplayBoardProps) {
  const { t } = useSessionTranslation();
  const entries = getScoreDisplayStandings(players, scoringRule);
  const { individual, shared } = getPhotoItemRows(columns, players, { labelsOnly: true });
  const teamOutcome = scoringRule === 'COOP' && players.length > 0
    ? t(calculateWinners(players, scoringRule).length > 0 ? 'screenshot_team_win' : 'screenshot_team_loss')
    : null;
  const read = createColorReader();
  const columnCount = Math.max(1, players.length <= 6 ? players.length : Math.min(6, Math.ceil(players.length / 2)));
  const side = (
    <div className="score-display-content">
      <header className="score-display-heading">
        <h2>{gameName}</h2>
        {teamOutcome && <span className="score-display-team">{teamOutcome}</span>}
        {renderPhotoLabels(shared, BOARD_SURFACE, read)}
      </header>
      <ul
        className="score-display-results"
        style={{ '--score-display-columns': columnCount } as React.CSSProperties}
      >
        {entries.map(({ player, rank, forcedLoss }) => {
          const score = formatDisplayNumber(player.totalScore);
          const isFirst = rank === 1;
          const hasPlayerColor = player.color && player.color !== 'transparent';
          const labels = renderPhotoLabels(
            individual.map(row => ({ id: row.id, value: row.values.get(player.id) })), CARD_SURFACE, read,
          );
          return (
            <li key={player.id} className="score-display-player" data-first-place={isFirst || undefined}>
              {(rank !== null || forcedLoss) && <div className="score-display-place">
                {isFirst && <Crown aria-hidden="true" className="score-display-crown" />}
                {rank !== null && <span>{t('score_display_rank', { rank })}</span>}
                {forcedLoss && <span>{t('screenshot_outcome_loss')}</span>}
              </div>}
              {hasPlayerColor ? (
                <ContrastText className="score-display-name" color={player.color} background={CARD_SURFACE} readColor={read}>
                  {player.name}
                </ContrastText>
              ) : <span className="score-display-name">{player.name}</span>}
              <strong className="score-display-total font-mono" style={{
                '--score-display-digits': Math.max(1, score.length),
              } as React.CSSProperties}>{score}</strong>
              {labels}
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <>
      <section className="score-display-side score-display-opposite" data-compact={players.length > 6 || undefined} aria-hidden="true">{side}</section>
      <section className="score-display-side" data-compact={players.length > 6 || undefined}>{side}</section>
    </>
  );
});

const ScoreDisplayModal: React.FC<ScoreDisplayModalProps> = ({ isOpen, onClose, ...board }) => {
  const { t } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();
  const closeButton = useRef<HTMLButtonElement>(null);
  const isClosing = useRef(false);
  const { zIndex, triggerClose } = useModalBackHandler(isOpen, onClose, 'session-score-display', { immediate: true });

  useEffect(() => {
    if (!isOpen) return;
    isClosing.current = false;
    const previouslyFocused = document.activeElement;
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  const closeDisplay = async () => {
    if (isClosing.current) return;
    isClosing.current = true;
    await triggerClose();
    onClose();
  };

  if (!isOpen) return null;
  return createPortal(
    <div
      className="score-display-viewport"
      role="dialog"
      aria-modal="true"
      aria-label={t('score_display_title')}
      style={{ zIndex }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          void closeDisplay();
        } else if (event.key === 'Tab') {
          event.preventDefault();
        }
      }}
    >
      <div className="score-display-stage">
        <ScoreDisplayBoard {...board} />
        <button ref={closeButton} type="button" className="score-display-close"
          aria-label={tCommon('close')} onClick={() => void closeDisplay()}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
    </div>, document.body,
  );
};

export default ScoreDisplayModal;
