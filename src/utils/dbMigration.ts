


import { db } from '../db';
import { migrateTemplate, migrateScores } from './dataMigration';
import { GameTemplate, GameSession } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';
import { generateId } from './idGenerator';

// 定義當前內建資料庫的版本
// [UPDATE] Increment this version whenever DEFAULT_TEMPLATES is modified
const CURRENT_BUILTIN_VERSION = 4; 

export const migrateFromLocalStorage = async () => {
  const MIGRATION_KEY = 'sm_migration_v1_done';
  const VERSION_KEY = 'sm_builtin_data_version';
  const NEW_BADGES_KEY = 'sm_new_badge_ids'; 
  const LIST_MIGRATION_KEY = 'sm_list_migration_v4_done';
  const OVERRIDE_MIGRATION_KEY = 'sm_override_fork_migration_v5_done';
  
  try {
    // --- Phase 1: 內建資料庫同步 (Seeding & Diffing) ---
    const savedVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0', 10);
    
    // 檢查舊資料是否存在 (用以判斷是否為全新安裝)
    const existingBuiltins = await db.builtins.toArray();
    const isFreshInstall = existingBuiltins.length === 0;
    
    if (savedVersion !== CURRENT_BUILTIN_VERSION || isFreshInstall) {
        console.log(`Updating built-in templates from v${savedVersion} to v${CURRENT_BUILTIN_VERSION}...`);
        
        if (!isFreshInstall) {
            const existingIds = new Set(existingBuiltins.map(t => t.id));
            const newArrivals = DEFAULT_TEMPLATES
                .filter(t => !existingIds.has(t.id))
                .map(t => t.id);

            if (newArrivals.length > 0) {
                console.log('Found new templates:', newArrivals);
                const currentBadges = JSON.parse(localStorage.getItem(NEW_BADGES_KEY) || '[]');
                const mergedBadges = Array.from(new Set([...currentBadges, ...newArrivals]));
                localStorage.setItem(NEW_BADGES_KEY, JSON.stringify(mergedBadges));
            }
        }
        
        await db.builtins.clear();
        const normalizedDefaults = DEFAULT_TEMPLATES.map(t => migrateTemplate(t));
        await db.builtins.bulkPut(normalizedDefaults);
        
        localStorage.setItem(VERSION_KEY, String(CURRENT_BUILTIN_VERSION));
        console.log('Built-in templates updated successfully.');
    }

    // --- Phase 2: 舊版 LocalStorage 遷移 (只執行一次) ---
    if (!localStorage.getItem(MIGRATION_KEY)) {
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

        localStorage.removeItem('sm_known_sys_ids');
        localStorage.setItem(MIGRATION_KEY, 'true');
    }

    // --- Phase 3: List Migration (Players/Locations) to IndexedDB ---
    if (!localStorage.getItem(LIST_MIGRATION_KEY)) {
        console.log('Migrating Lists (Players/Locations) to IndexedDB...');
        
        const playerHistoryStr = localStorage.getItem('sm_player_history');
        if (playerHistoryStr) {
            try {
                const players: string[] = JSON.parse(playerHistoryStr);
                if (Array.isArray(players)) {
                    const now = Date.now();
                    const bulkPlayers = players.map((name, idx) => ({
                        name: name.trim(),
                        lastUsed: now - idx * 1000,
                        usageCount: 1
                    })).filter(p => p.name);
                    
                    const uniquePlayers = Array.from(new Map(bulkPlayers.map(item => [item.name, item])).values());
                    await db.savedPlayers.bulkPut(uniquePlayers);
                }
            } catch (e) {
                console.error("Failed to migrate player history", e);
            }
        }

        const allHistory = await db.history.toArray();
        const locationsMap = new Map<string, { name: string, lastUsed: number, count: number }>();
        
        allHistory.forEach(record => {
            if (record.location && record.location.trim()) {
                const loc = record.location.trim();
                const existing = locationsMap.get(loc);
                if (existing) {
                    existing.count++;
                    existing.lastUsed = Math.max(existing.lastUsed, record.endTime);
                } else {
                    locationsMap.set(loc, { name: loc, lastUsed: record.endTime, count: 1 });
                }
            }
        });

        if (locationsMap.size > 0) {
            const locationsToSave = Array.from(locationsMap.values()).map(l => ({
                name: l.name,
                lastUsed: l.lastUsed,
                usageCount: l.count
            }));
            await db.savedLocations.bulkPut(locationsToSave);
        }

        localStorage.removeItem('sm_player_history');
        localStorage.setItem(LIST_MIGRATION_KEY, 'true');
    }

    // --- Phase 4: Overrides Fork Migration (SystemOverrides -> Templates with UUID) ---
    if (!localStorage.getItem(OVERRIDE_MIGRATION_KEY)) {
        console.log('Migrating System Overrides to Forked Templates...');
        
        const overrides = await db.systemOverrides.toArray();
        
        if (overrides.length > 0) {
            await (db as any).transaction('rw', db.templates, db.systemOverrides, db.sessions, db.history, db.images, async () => {
                for (const override of overrides) {
                    const oldId = override.id;
                    const newId = generateId(); // Create new UUID
                    
                    // 1. Convert to Forked Template
                    const forkedTemplate: GameTemplate = {
                        ...override,
                        id: newId,
                        sourceTemplateId: oldId, // Link back to original
                        // Ensure timestamps exist
                        updatedAt: override.updatedAt || Date.now(),
                        createdAt: override.createdAt || Date.now(),
                    };
                    
                    // 2. Save to templates table
                    await db.templates.add(forkedTemplate);
                    
                    // 3. Migrate related Sessions
                    await db.sessions.where('templateId').equals(oldId).modify({ templateId: newId });
                    
                    // 4. Migrate related History
                    await db.history.where('templateId').equals(oldId).modify({ templateId: newId });
                    
                    // 5. Migrate related Images (Backgrounds)
                    await db.images.where('relatedId').equals(oldId).modify({ relatedId: newId });
                }
                
                // 6. Clear systemOverrides table (It is now deprecated but kept in schema for safety)
                await db.systemOverrides.clear();
            });
        }
        
        localStorage.setItem(OVERRIDE_MIGRATION_KEY, 'true');
        console.log('Overrides migration completed.');
    }

  } catch (error) {
    console.error('Migration/Seeding failed:', error);
  }
};