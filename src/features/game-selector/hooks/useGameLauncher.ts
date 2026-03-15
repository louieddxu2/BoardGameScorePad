
import { GameTemplate, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { useToast } from '../../../hooks/useToast';
import { db } from '../../../db';
import { generateId } from '../../../utils/idGenerator';
import { useAppTranslation } from '../../../i18n/app';
import { createTemplateFromOption } from '../../../utils/templateUtils';

interface UseGameLauncherProps {
  allVisibleTemplates: GameTemplate[];
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
  onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean; preserveTimestamps?: boolean }) => void;
  // [Changed] Add optional locationId to the callback signature
  onGameStart: (template: GameTemplate, playerCount: number, location: string, locationId?: string, extra?: { startTimeStr?: string, scoringRule?: ScoringRule }) => void;
}

export const useGameLauncher = ({
  allVisibleTemplates,
  onGetFullTemplate,
  onTemplateSave,
  onGameStart
}: UseGameLauncherProps) => {
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const handlePanelStart = async (option: GameOption, playerCount: number, location: string, locationId?: string, extra?: { startTimeStr?: string, scoringRule?: ScoringRule }) => {
    let templateToStart: GameTemplate;

    // 1. Resolve Template Source
    if (option.templateId) {
      // [Case A] Existing Template (Standard Flow)
      let found: GameTemplate | undefined | null = allVisibleTemplates.find(t => t.id === option.templateId);

      if (!found) {
        // Fallback: Fetch from DB (full load)
        found = await onGetFullTemplate(option.templateId);
      }

      if (found) {
        templateToStart = found;
      } else {
        showToast({ message: t('app_toast_launch_error'), type: 'error' });
        return;
      }
    } else {
      // [Case B] No Existing Template (Virtual Option / SavedGame Promotion)
      // Logic: Create a new transient template on the fly and SAVE it.
      // This handles both "Promoting a SavedGame to a Template" and "Creating a fresh game from Search".

      templateToStart = createTemplateFromOption(option, {
        lastPlayerCount: playerCount
      });

      // Save immediately to allow session start
      // { skipCloud: true } to save time, it will sync eventually
      await onTemplateSave(templateToStart, { skipCloud: true });
    }

    try {
      // 2. Save Session Preferences (Player Count, etc.)
      // Note: We use templateToStart.id. If it was a new/promoted template, this is the NEW ID.

      await db.templatePrefs.put({
        templateId: templateToStart.id,
        lastPlayerCount: playerCount,
        updatedAt: Date.now()
      });

      // 3. Launch Session Directly (Bypassing Setup Modal)
      // [Changed] Pass locationId
      onGameStart(templateToStart, playerCount, location, locationId, extra);
    } catch (e) {
      console.error("Failed to start game", e);
      // Fallback launch even if prefs fail
      onGameStart(templateToStart, playerCount, location, locationId, extra);
    }
  };

  return { handlePanelStart };
};
