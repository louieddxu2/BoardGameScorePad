
import { db } from '../../../db';
import { entityService } from '../../../services/entityService';
import { bgStatsEntityService } from './bgStatsEntityService';
import { BgStatsGame, ManualLink } from '../types';

/**
 * Import Strategies (Unified UUID Version)
 * 職責：
 * 1. 決策 (Decision): 決定要使用哪個 ID (手動指定 or 自動配對 or 新增(使用 Source UUID))。
 * 2. 委派 (Delegate): 將 ID 與資料交給 bgStatsEntityService 執行寫入。
 */
export const importStrategies = {

  async resolveGame(sourceGame: BgStatsGame, link?: ManualLink, options: { backfillHistory?: boolean } = {}): Promise<string> {
    let targetId: string | undefined = undefined;

    // --- Phase 1: Decision ---
    if (link) {
        // A. 使用者手動連結
        targetId = link.targetId;
    } else {
        // B. 自動配對嘗試 (Fallback)
        const analysis = await entityService.analyzeEntity(
            db.savedGames, 
            sourceGame.name,
            'game',
            { 
                bggId: sourceGame.bggId?.toString(), 
                bgStatsId: sourceGame.uuid // Will check if ID == uuid
            }
        );

        if (analysis.status !== 'NEW' && analysis.match) {
            targetId = analysis.match.id;
        } 
        
        // C. 補強檢查：Templates (Name Match)
        if (!targetId) {
            const templateMatch = await db.templates.where('name').equals(sourceGame.name.trim()).first();
            if (templateMatch) {
                targetId = templateMatch.id;
            }
        }
    }

    // --- Phase 2: Execution ---
    if (targetId) {
        // [連結模式] - 可能更新 BGG ID
        await bgStatsEntityService.bindGame(targetId, sourceGame, options);
        return targetId;
    } else {
        // [新增模式] - 使用 Source UUID
        return await bgStatsEntityService.createGame(sourceGame, options);
    }
  },

  async resolvePlayer(name: string, sourceUuid: string, link?: ManualLink): Promise<string> {
    let targetId: string | undefined = undefined;

    if (link) {
        targetId = link.targetId;
    } else {
        const analysis = await entityService.analyzeEntity(
            db.savedPlayers,
            name,
            'player',
            { bgStatsId: sourceUuid }
        );
        if (analysis.status !== 'NEW' && analysis.match) {
            targetId = analysis.match.id;
        }
    }

    if (targetId) {
        await bgStatsEntityService.bindPlayer(targetId, sourceUuid);
        return targetId;
    } else {
        return await bgStatsEntityService.createPlayer(name, sourceUuid);
    }
  },

  async resolveLocation(name: string, sourceUuid: string, link?: ManualLink): Promise<string> {
    let targetId: string | undefined = undefined;

    if (link) {
        targetId = link.targetId;
    } else {
        const analysis = await entityService.analyzeEntity(
            db.savedLocations,
            name,
            'location',
            { bgStatsId: sourceUuid }
        );
        if (analysis.status !== 'NEW' && analysis.match) {
            targetId = analysis.match.id;
        }
    }

    if (targetId) {
        await bgStatsEntityService.bindLocation(targetId, sourceUuid);
        return targetId;
    } else {
        return await bgStatsEntityService.createLocation(name, sourceUuid);
    }
  }
};
