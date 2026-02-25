
import { GameTemplate } from '../../../types';
import { GameOption } from '../types';
import { useToast } from '../../../hooks/useToast';
import { db } from '../../../db';
import { generateId } from '../../../utils/idGenerator';

interface UseGameLauncherProps {
  allVisibleTemplates: GameTemplate[];
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
  onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean; preserveTimestamps?: boolean }) => void;
  // [Changed] Add optional locationId to the callback signature
  onGameStart: (template: GameTemplate, playerCount: number, location: string, locationId?: string) => void;
}

export const useGameLauncher = ({
  allVisibleTemplates,
  onGetFullTemplate,
  onTemplateSave,
  onGameStart
}: UseGameLauncherProps) => {
  const { showToast } = useToast();

  const handlePanelStart = async (option: GameOption, playerCount: number, location: string, locationId?: string) => {
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
        showToast({ message: "找不到模板", type: 'error' });
        return;
      }
    } else {
      // [Case B] No Existing Template (Virtual Option / SavedGame Promotion)
      // Logic: Create a new transient template on the fly and SAVE it.
      // This handles both "Promoting a SavedGame to a Template" and "Creating a fresh game from Search".

      templateToStart = {
        id: generateId(), // Create new UUID for the template (Clean Slate)
        name: option.cleanName || option.displayName, // [Fix] Use clean name if available
        columns: [], // Empty columns = Simple Mode
        bggId: option.bggId || '', // Inherit BGG ID if available
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Default settings for quick start
        lastPlayerCount: playerCount,
        defaultScoringRule: (option.defaultScoringRule as any) || 'HIGHEST_WINS',
        hasImage: false
      };

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
      onGameStart(templateToStart, playerCount, location, locationId);

    } catch (e) {
      console.error("Failed to start game", e);
      // Fallback launch even if prefs fail
      onGameStart(templateToStart, playerCount, location, locationId);
    }
  };

  return { handlePanelStart };
};
