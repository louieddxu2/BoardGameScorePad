
import { db } from '../db';
import { migrateTemplate, migrateScores } from './dataMigration';
import { GameTemplate, GameSession } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';

// 定義當前內建資料庫的版本
const CURRENT_BUILTIN_VERSION = 2; 

export const migrateFromLocalStorage = async () => {
  const MIGRATION_KEY = 'sm_migration_v1_done';
  const VERSION_KEY = 'sm_builtin_data_version';
  const NEW_BADGES_KEY = 'sm_new_badge_ids'; // 新的 Key，只存「未讀的新增項目」
  
  try {
    // --- Phase 1: 內建資料庫同步 (Seeding & Diffing) ---
    const savedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0', 10);
    
    // 檢查舊資料是否存在 (用以判斷是否為全新安裝)
    const existingBuiltins = await db.builtins.toArray();
    const isFreshInstall = existingBuiltins.length === 0;
    
    if (savedVersion !== CURRENT_BUILTIN_VERSION || isFreshInstall) {
        console.log(`Updating built-in templates from v${savedVersion} to v${CURRENT_BUILTIN_VERSION}...`);
        
        // [核心修改] 在清空前，計算差異 (Diff)
        // 只有在「不是全新安裝」且「有版本更新」時才計算
        if (!isFreshInstall) {
            const existingIds = new Set(existingBuiltins.map(t => t.id));
            const newArrivals = DEFAULT_TEMPLATES
                .filter(t => !existingIds.has(t.id))
                .map(t => t.id);

            if (newArrivals.length > 0) {
                console.log('Found new templates:', newArrivals);
                // 讀取現有的未讀列表 (可能還有上次沒點掉的)
                const currentBadges = JSON.parse(localStorage.getItem(NEW_BADGES_KEY) || '[]');
                // 合併並去重
                const mergedBadges = Array.from(new Set([...currentBadges, ...newArrivals]));
                localStorage.setItem(NEW_BADGES_KEY, JSON.stringify(mergedBadges));
            }
        }
        
        // 1. 清空舊的內建資料
        await db.builtins.clear();
        
        // 2. 寫入新的內建資料
        const normalizedDefaults = DEFAULT_TEMPLATES.map(t => migrateTemplate(t));
        await db.builtins.bulkPut(normalizedDefaults);
        
        // 3. 更新版號
        localStorage.setItem(VERSION_KEY, String(CURRENT_BUILTIN_VERSION));
        console.log('Built-in templates updated successfully.');
    }

    // --- Phase 2: 舊版 LocalStorage 遷移 (只執行一次) ---
    if (!localStorage.getItem(MIGRATION_KEY)) {
        // ... (Migration logic remains unchanged)
        console.log('Starting migration from LocalStorage to IndexedDB...');

        // 1. 遷移自訂模板
        const savedTemplatesStr = localStorage.getItem('sm_templates');
        if (savedTemplatesStr) {
            const oldTemplates: any[] = JSON.parse(savedTemplatesStr);
            const newTemplates = oldTemplates.map(t => migrateTemplate(t));
            if (newTemplates.length > 0) {
                await db.templates.bulkPut(newTemplates);
            }
        }

        // 2. 遷移系統覆寫
        const savedOverridesStr = localStorage.getItem('sm_system_overrides');
        if (savedOverridesStr) {
            const oldOverrides: Record<string, any> = JSON.parse(savedOverridesStr);
            const newOverrides = Object.values(oldOverrides).map(t => migrateTemplate(t));
            if (newOverrides.length > 0) {
                await db.systemOverrides.bulkPut(newOverrides);
            }
        }

        // 3. 遷移所有 Session
        const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith('sm_session_'));
        const sessionsToMigrate: GameSession[] = [];
        const allTemplatesMap = new Map<string, GameTemplate>();
        
        const dbTemplates = await db.templates.toArray();
        const dbBuiltins = await db.builtins.toArray();
        const dbOverrides = await db.systemOverrides.toArray();
        
        dbBuiltins.forEach(t => allTemplatesMap.set(t.id, t));
        dbOverrides.forEach(t => allTemplatesMap.set(t.id, t));
        dbTemplates.forEach(t => allTemplatesMap.set(t.id, t));

        for (const key of sessionKeys) {
            try {
                const sessionData = JSON.parse(localStorage.getItem(key) || '{}');
                if (sessionData && sessionData.id && sessionData.templateId) {
                    const template = allTemplatesMap.get(sessionData.templateId);
                    if (template) {
                        sessionData.players = sessionData.players.map((p: any) => ({ 
                            ...p, 
                            scores: migrateScores(p.scores, template) 
                        }));
                        sessionsToMigrate.push(sessionData as GameSession);
                    }
                }
            } catch (e) {
                console.warn(`Failed to migrate session ${key}`, e);
            }
        }

        if (sessionsToMigrate.length > 0) {
            await db.sessions.bulkPut(sessionsToMigrate);
        }

        // 移除舊的 Known IDs (因為我們換了新機制，舊的龐大資料可以刪了)
        localStorage.removeItem('sm_known_sys_ids');
        
        localStorage.setItem(MIGRATION_KEY, 'true');
    }

  } catch (error) {
    console.error('Migration/Seeding failed:', error);
  }
};
