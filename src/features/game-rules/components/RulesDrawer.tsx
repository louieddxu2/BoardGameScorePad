import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { useRulesTranslation } from '../../../i18n/rules';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { ruleRecordLink, ruleSiteLink } from '../rulesApi';
import type { GameRulesState } from '../hooks/useGameRuleData';
import RulesBrowser from './RulesBrowser';
import RulesSiteLogo from './RulesSiteLogo';

// The rules site's own colors, so its row reads as a link to that site in every app theme.
const SITE_PAPER = '#f6f3eb';
const SITE_INK = '#16352f';
const CLOSE_DISTANCE = 80;
/** Slide in and out from the right. */
const SLIDE_MS = 240;

interface RulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameRulesState;
}

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

/**
 * Rules for the current game in a drawer from the right. It leaves the item-name column
 * visible; tapping that strip, swiping right or pressing Back closes it.
 */
const RulesDrawer: React.FC<RulesDrawerProps> = ({ isOpen, onClose, state }) => {
  const { t } = useRulesTranslation();
  const [dragX, setDragX] = useState(0);
  const start = useRef<{ x: number; y: number; horizontal?: boolean } | null>(null);
  const { zIndex } = useModalBackHandler(isOpen, onClose, 'game-rules-drawer');
  // Stay mounted while sliding out, at the layer it had while open.
  const [mounted, setMounted] = useState(isOpen);
  const [shown, setShown] = useState(false);
  const lastZIndex = useRef(zIndex);
  if (isOpen) lastZIndex.current = zIndex;
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Start off-screen, then slide in on the next frame.
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => {
      setMounted(false);
      setDragX(0);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);
  if (!mounted) return null;

  const slug = state.status === 'ready' ? state.rules?.slug : undefined;

  const onTouchStart = (event: React.TouchEvent) => {
    // A row that scrolls sideways (the tags) keeps its swipes.
    if ((event.target as HTMLElement).closest?.('[data-drawer-no-swipe]')) {
      start.current = null;
      return;
    }
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchMove = (event: React.TouchEvent) => {
    const origin = start.current;
    if (!origin) return;
    const touch = event.touches[0];
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (origin.horizontal === undefined && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) origin.horizontal = Math.abs(dx) > Math.abs(dy);
    if (origin.horizontal) setDragX(Math.max(0, dx));
  };
  const onTouchEnd = () => {
    const shouldClose = dragX > CLOSE_DISTANCE;
    start.current = null;
    // A closing swipe slides on from where the finger let go; otherwise it springs back.
    if (shouldClose) onClose();
    else setDragX(0);
  };

  const dragging = start.current !== null && dragX > 0;
  const offset = !shown ? '100%' : `${dragX}px`;

  return (
    <div className="fixed inset-0 flex" role="presentation" style={{ zIndex: lastZIndex.current }}>
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="h-full w-[72px] shrink-0 grow bg-modal-backdrop/40 transition-opacity ease-out"
        style={{ opacity: shown ? 1 : 0, transitionDuration: `${SLIDE_MS}ms` }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('site_name')}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translateX(${offset})`,
          transition: dragging ? 'none' : `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        className="flex h-full w-[calc(100%-72px)] max-w-md flex-col border-l border-surface-border bg-app-bg shadow-2xl"
      >
        <header className="safe-area-top-medium flex shrink-0 items-center gap-2 px-3 pb-2.5" style={{ backgroundColor: SITE_PAPER, color: SITE_INK }}>
          <RulesSiteLogo size={24} className="shrink-0 rounded-md" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{t('site_name')}</span>
          {slug && (
            <>
              <button type="button" onClick={() => openExternal(ruleRecordLink(slug))} aria-label={t('record_aria')}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-bold" style={{ borderColor: SITE_INK }}>
                <Plus size={14} aria-hidden="true" />{t('record')}
              </button>
              <button type="button" onClick={() => openExternal(ruleSiteLink(slug))} aria-label={t('open_site_aria')}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-bold" style={{ borderColor: SITE_INK }}>
                {t('open_site')}<ExternalLink size={13} aria-hidden="true" />
              </button>
            </>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-3">
          {state.status === 'ready' && state.stale && <p className="mb-3 text-xs text-txt-muted">{t('stale_notice')}</p>}
          {state.status === 'ready' && state.rules ? (
            <RulesBrowser rules={state.rules} />
          ) : (
            <p role="status" className="py-8 text-center text-sm text-txt-muted">
              {state.status === 'failed' ? t('load_failed') : state.status === 'ready' ? t('no_rules') : t('loading')}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
};

export default RulesDrawer;
