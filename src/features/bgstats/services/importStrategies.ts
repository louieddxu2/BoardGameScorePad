
import { db } from '../../../db';
import { entityService } from '../../../services/entityService';
import { bgStatsEntityService } from './bgStatsEntityService';
import { BgStatsGame, ManualLink } from '../types';

/**
 * Import Strategies (Refactored)
 * 職責：
 * 1. 決策 (Decision): 決定要使用哪個 Local ID (手動指定 or 自動配對 or 無)。
 * 2. 委派 (Delegate): 將 ID 與資料交給 bgStatsEntityService 執行寫入。
 */
export const importStrategies = {

  async resolveGame(sourceGame: BgStatsGame, link?: ManualLink): Promise<string> {
    let targetId: string | undefined = undefined;

    // --- Phase 1: Decision ---
    if (link) {
        // A. 使用者手動連結
        targetId = link.targetId;
    } else {
        // B. 自動配對嘗試 (Fallback)
        // 雖然 UI 階段已經做過一次，但為了確保批次匯入時的完整性，
        // 若使用者未在 UI 指定連結 (ManualLink)，我們再次嘗試自動配對現有資料
        const analysis = await entityService.analyzeEntity(
            db.savedGames, 
            sourceGame.name,
            'game',
            { 
                bggId: sourceGame.bggId?.toString(), 
                bgStatsId: sourceGame.uuid 
            }
        );

        if (analysis.status !== 'NEW' && analysis.match) {
            targetId = analysis.match.id;
        } 
        
        // C. 補強檢查：Templates (有些內建遊戲可能還沒在 savedGames 裡)
        if (!targetId) {
            const templateMatch = await db.templates.where('name').equals(sourceGame.name.trim()).first();
            if (templateMatch) {
                targetId = templateMatch.id;
            }
        }
    }

    // --- Phase 2: Execution ---
    if (targetId) {
        // [連結模式] 將外部 ID 寫入目標 (確保 SavedGame 存在並更新連結)
        await bgStatsEntityService.bindGame(targetId, sourceGame);
        return targetId;
    } else {
        // [新增模式] 僅建立 SavedGame 紀錄
        return await bgStatsEntityService.createGame(sourceGame);
    }
  },

  async resolvePlayer(name: string, sourceUuid: string, link?: ManualLink): Promise<string> {
    let targetId: string | undefined = undefined;

    // Phase 1: Decision
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

    // Phase 2: Execution
    if (targetId) {
        await bgStatsEntityService.bindPlayer(targetId, sourceUuid);
        return targetId;
    } else {
        return await bgStatsEntityService.createPlayer(name, sourceUuid);
    }
  },

  async resolveLocation(name: string, sourceUuid: string, link?: ManualLink): Promise<string> {
    let targetId: string | undefined = undefined;

    // Phase 1: Decision
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

    // Phase 2: Execution
    if (targetId) {
        await bgStatsEntityService.bindLocation(targetId, sourceUuid);
        return targetId;
    } else {
        return await bgStatsEntityService.createLocation(name, sourceUuid);
    }
  }
};
