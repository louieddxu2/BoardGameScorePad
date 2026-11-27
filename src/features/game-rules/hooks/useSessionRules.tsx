import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../i18n';
import { useCloudDataEnabled } from '../../cloud-data/cloudDataPreference';
import { useGameRules, useRuleSummary } from './useGameRuleData';
import RulesEntryButton from '../components/RulesEntryButton';
import RulesDrawer from '../components/RulesDrawer';

/**
 * The rules entry and drawer for a game session. The entry appears only in Chinese (the rules
 * are written in Chinese) and only when the game's BGG ID leads to at least one rule.
 */
export const useSessionRules = (bggId: string | undefined) => {
  const { language } = useTranslation();
  const canShowRules = useCloudDataEnabled() && language === 'zh-TW';
  const summary = useRuleSummary(bggId, canShowRules);
  const [isOpen, setIsOpen] = useState(false);
  const state = useGameRules(summary, isOpen);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  useEffect(() => {
    if (!canShowRules) close();
  }, [canShowRules, close]);

  // Once read, the rules give the current count even if the hour-old summary does not.
  const count = state.status === 'ready' ? state.rules?.rules.length ?? 0 : summary?.publishedRuleCount ?? 0;
  const entry = summary && count > 0 ? <RulesEntryButton count={count} onClick={open} /> : null;
  const drawer = summary ? <RulesDrawer isOpen={isOpen} onClose={close} state={state} /> : null;
  return { entry, drawer };
};
