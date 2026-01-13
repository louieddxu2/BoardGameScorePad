
import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import { migrateFromLocalStorage } from '../utils/dbMigration';
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { googleDriveService } from '../services/googleDrive';
import { imageService } from '../services/imageService';
import { cleanupService } from '../services/cleanupService';
import { useToast } from './useToast';
import { migrateTemplate } from '../utils/dataMigration';
import { generateId } from '../utils/idGenerator';

// Sub-hooks
import { useAppQueries } from './useAppQueries';
import { useSessionManager } from './useSessionManager';

export const useAppData = () => {
  const { showToast } = useToast();
  const [isDbReady, setIsDbReady] = useState(false);
  
  // [Search State]
  const [searchQuery, setSearchQuery] = useState('');

  // [System Dirty Tracking] - Timestamp of last modification to system data
  const [systemDirtyTime, setSystemDirtyTime] = useState<number>(0);
  const markSystemDirty = () => setSystemDirtyTime(Date.now());

  // --- 1. Initialization & Migration ---
  useEffect(() => {
    const init = async () => {
      await migrateFromLocalStorage();
      setIsDbReady(true);
    };
    init();
  }, []);

  // --- 2. Queries & Session Management ---
  const queries = useAppQueries(searchQuery);
  
  // Check cloud availability helper
  const isCloudEnabled = () => {
      return localStorage.getItem('google_drive_auto_connect') === 'true';
  };

  const sessionManager = useSessionManager({
      getTemplate: queries.getTemplate,
      activeSessions: queries.activeSessions,
      updatePlayerHistory: (name) => updatePlayerHistory(name),
      isCloudEnabled
  });

  // --- 3. LocalStorage Settings & Global Actions ---
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => 
      (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
  );
  
  const [newBadgeIds, setNewBadgeIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_new_badge_ids') || '[]'); } catch { return []; }
  });

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
      try { return JSON.parse(localStorage.getItem('sm_pinned_ids') || '[]'); } catch { return []; }
  });

  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => { localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds)); }, [newBadgeIds]);
  useEffect(() => { 
      localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
  }, [pinnedIds]);
  
  useEffect(() => { 
      localStorage.setItem('app_theme', themeMode);
      document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
      setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
      markSystemDirty();
  };

  const togglePin = (id: string) => {
      setPinnedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [id, ...prev]);
      markSystemDirty();
  };

  const clearNewBadges = () => { 
      setNewBadgeIds([]); 
      markSystemDirty();
  };

  const updatePlayerHistory = useCallback((name: string) => {
      if (!name.trim()) return;
      const cleanName = name.trim();
      
      (db as any).transaction('rw', db.savedPlayers, async () => {
          const existing = await db.savedPlayers.where('name').equals(cleanName).first();
          if (existing) {
              await db.savedPlayers.update(existing.id!, { lastUsed: Date.now(), usageCount: (existing.usageCount || 0) + 1 });
          } else {
              await db.savedPlayers.add({ name: cleanName, lastUsed: Date.now(), usageCount: 1 });
          }
      }).then(() => {
          markSystemDirty();
      }).catch(console.error);
  }, []);

  const updateLocationHistory = useCallback((name: string) => {
      if (!name.trim()) return;
      const cleanName = name.trim();
      (db as any).transaction('rw', db.savedLocations, async () => {
          const existing = await db.savedLocations.where('name').equals(cleanName).first();
          if (existing) {
              await db.savedLocations.update(existing.id!, { lastUsed: Date.now(), usageCount: (existing.usageCount || 0) + 1 });
          } else {
              await db.savedLocations.add({ name: cleanName, lastUsed: Date.now(), usageCount: 1 });
          }
      }).then(() => {
          markSystemDirty();
      }).catch(console.error);
  }, []);

  // --- CRUD Actions ---

  const saveTemplate = async (template: GameTemplate, options: { skipCloud?: boolean, preserveTimestamps?: boolean } = {}) => {
    const finalUpdatedAt = options.preserveTimestamps ? (template.updatedAt || Date.now()) : Date.now();
    const migratedTemplate = migrateTemplate({ ...template, updatedAt: finalUpdatedAt });
    
    const isSystem = !!(await db.builtins.get(migratedTemplate.id));
    if (isSystem) {
        await db.systemOverrides.put(migratedTemplate);
    } else {
        await db.templates.put(migratedTemplate);
    }
    if (!options.skipCloud && isCloudEnabled() && !isSystem) {
        googleDriveService.backupTemplate(migratedTemplate).then((updated) => {
            db.templates.update(updated.id, { lastSyncedAt: Date.now() });
        }).catch(console.error);
    }
  };

  const deleteTemplate = async (id: string) => {
      try {
          const templateToDelete = await queries.getTemplate(id); 
          
          // 1. Delete associated active sessions first to avoid orphaned data
          const relatedSessions = await db.sessions.where('templateId').equals(id).toArray();
          if (relatedSessions.length > 0) {
              for (const s of relatedSessions) {
                  await cleanupService.cleanSessionArtifacts(s.id, s.cloudFolderId);
              }
              await db.sessions.bulkDelete(relatedSessions.map(s => s.id));
          }

          // 2. Delete the template itself
          await db.templates.delete(id);
          
          // 3. Cleanup template-related data
          await db.templatePrefs.delete(id);
          await imageService.deleteImagesByRelatedId(id);

          // 4. Cloud cleanup
          if (isCloudEnabled() && templateToDelete) {
              googleDriveService.softDeleteFolder(id, 'template').then(() => {
                  showToast({ message: "已同步移至雲端垃圾桶", type: 'info' });
              }).catch(console.error);
          }
      } catch (error) {
          console.error("Delete failed", error);
          showToast({ message: "刪除失敗，請重試", type: 'error' });
      }
  };

  /**
   * Restore System Template Logic:
   * 1. Copies the current override to a new Custom Template (Backup).
   * 2. Migrates all active sessions from the System ID to the new Custom ID.
   * 3. Migrates background images and preferences.
   * 4. Deletes the System Override (reverting to built-in default).
   */
  const restoreSystemTemplate = async (templateId: string) => {
      try {
          const overrideData = await db.systemOverrides.get(templateId);
          if (!overrideData) return;

          const backupId = generateId();
          // Backup as a new custom template
          const backupTemplate: GameTemplate = {
              ...overrideData,
              id: backupId,
              name: overrideData.name, // Keep original name
              updatedAt: Date.now(),
              cloudImageId: undefined, // Reset cloud ID to allow fresh backup
              lastSyncedAt: undefined
          };
          
          // Find related items
          const relatedSessions = await db.sessions.where('templateId').equals(templateId).toArray();
          const relatedImages = await db.images.where('relatedId').equals(templateId).toArray(); // Images associated with the template (backgrounds)

          // Execute as atomic transaction
          // Use (db as any) to workaround TS definition issues with Dexie transactions if needed
          await (db as any).transaction('rw', db.templates, db.systemOverrides, db.sessions, db.images, db.templatePrefs, async () => {
              // 1. Add Backup
              await db.templates.add(backupTemplate);

              // 2. Migrate Active Sessions to Backup
              for (const session of relatedSessions) {
                  await db.sessions.update(session.id, { templateId: backupId });
              }

              // 3. Migrate Template Images to Backup
              for (const img of relatedImages) {
                  await db.images.update(img.id, { relatedId: backupId });
              }

              // 4. Migrate Preferences
              const prefs = await db.templatePrefs.get(templateId);
              if (prefs) {
                  await db.templatePrefs.put({ ...prefs, templateId: backupId });
                  await db.templatePrefs.delete(templateId);
              }

              // 5. Delete the System Override
              await db.systemOverrides.delete(templateId);
          });

          // Cloud Cleanup (Async)
          if (isCloudEnabled()) {
              googleDriveService.softDeleteFolder(overrideData.id, 'template').catch(console.error);
          }
          
          showToast({ message: "已還原預設值 (設定已備份)", type: 'success' });

      } catch (error) {
          console.error("Restore failed", error);
          showToast({ message: "還原失敗", type: 'error' });
      }
  };

  const deleteHistoryRecord = async (id: string) => { 
      try {
          const record = await db.history.get(id);
          await db.history.delete(id);
          await imageService.deleteImagesByRelatedId(id);

          if (isCloudEnabled() && record?.cloudFolderId) {
              googleDriveService.softDeleteFolder(record.cloudFolderId, 'history').catch(console.error);
          }

          showToast({ message: "紀錄已刪除", type: 'info' });
      } catch (error) {
          console.error("Failed to delete history:", error);
          showToast({ message: "刪除失敗", type: 'error' });
      }
  };
  
  const viewHistory = (record: HistoryRecord | null) => { setViewingHistoryRecord(record); };

  // --- Export System Data ---
  const getSystemExportData = async () => {
      const players = await db.savedPlayers.toArray();
      const locations = await db.savedLocations.toArray();
      const customTemplates = await db.templates.toArray();
      const overrides = await db.systemOverrides.toArray();
      const history = await db.history.toArray();
      const activeSessions = await db.sessions.toArray(); 
      
      return {
          preferences: {
              theme: themeMode,
              pinnedIds,
              newBadgeIds, 
              zoomLevel: parseFloat(localStorage.getItem('app_zoom_level') || '1.0'),
              isEditMode: localStorage.getItem('app_edit_mode') !== 'false'
          },
          library: {
              players,
              locations
          },
          data: {
              templates: customTemplates,
              overrides: overrides,
              history: history,
              sessions: activeSessions
          },
          timestamp: Date.now()
      };
  };

  const importSystemSettings = async (settings: any) => {
      try {
          if (settings.preferences) {
              const { theme, pinnedIds, newBadgeIds, zoomLevel, isEditMode } = settings.preferences;
              if (theme) {
                  setThemeMode(theme);
                  localStorage.setItem('app_theme', theme);
              }
              if (pinnedIds) {
                  setPinnedIds(pinnedIds);
                  localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
              }
              if (newBadgeIds) {
                  setNewBadgeIds(newBadgeIds);
                  localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds));
              }
              if (zoomLevel) localStorage.setItem('app_zoom_level', String(zoomLevel));
              if (isEditMode !== undefined) localStorage.setItem('app_edit_mode', String(isEditMode));
          }

          if (settings.library) {
              if (Array.isArray(settings.library.players)) {
                  await db.savedPlayers.bulkPut(settings.library.players);
              }
              if (Array.isArray(settings.library.locations)) {
                  await db.savedLocations.bulkPut(settings.library.locations);
              }
          }
          console.log("System settings restored successfully");
      } catch (e) {
          console.error("Failed to restore settings", e);
      }
  };

  const importSession = async (session: GameSession) => {
      try {
          await db.sessions.put(session);
          showToast({ message: "遊戲進度已匯入", type: 'success' });
      } catch (e) {
          console.error("Failed to import session", e);
          showToast({ message: "匯入失敗", type: 'error' });
      }
  };

  const importHistoryRecord = async (record: HistoryRecord) => {
      try {
          await db.history.put(record);
          showToast({ message: "歷史紀錄已還原", type: 'success' });
      } catch (e) {
          console.error("Failed to import history", e);
          showToast({ message: "還原失敗", type: 'error' });
      }
  };
  
  const saveImage = async (blob: Blob, relatedId: string, type: 'template' | 'session') => {
      return await imageService.saveImage(blob, relatedId, type);
  };
  
  const loadImage = async (id: string) => {
      return await imageService.getImage(id);
  };

  return { 
      searchQuery,
      setSearchQuery,
      // Data from Queries
      templates: queries.templates, 
      userTemplatesCount: queries.userTemplatesCount,
      systemTemplates: queries.systemTemplates, 
      systemTemplatesCount: queries.systemTemplatesCount,
      systemOverrides: queries.systemOverrides,
      activeSessionIds: queries.activeSessionIds, 
      historyRecords: queries.historyRecords,
      historyCount: queries.historyCount,
      playerHistory: queries.playerHistory, 
      locationHistory: queries.locationHistory,
      getTemplate: queries.getTemplate, 
      getSessionPreview: queries.getSessionPreview,
      // Session Manager State
      currentSession: sessionManager.currentSession, 
      activeTemplate: sessionManager.activeTemplate, 
      sessionImage: sessionManager.sessionImage, 
      sessionPlayerCount: sessionManager.sessionPlayerCount,
      // Global State
      newBadgeIds, 
      pinnedIds, 
      themeMode, 
      viewingHistoryRecord,
      systemDirtyTime,
      isDbReady,
      // Actions - Session
      startSession: sessionManager.startSession, 
      resumeSession: sessionManager.resumeSession, 
      discardSession: sessionManager.discardSession, 
      clearAllActiveSessions: sessionManager.clearAllActiveSessions, 
      updateSession: sessionManager.updateSession, 
      resetSessionScores: sessionManager.resetSessionScores, 
      exitSession: sessionManager.exitSession, 
      saveToHistory: sessionManager.saveToHistory, 
      updateActiveTemplate: sessionManager.updateActiveTemplate,
      setSessionImage: sessionManager.setSessionImage,
      // Actions - Global
      setTemplates: () => {}, 
      toggleTheme, 
      togglePin, 
      clearNewBadges,
      updatePlayerHistory, 
      updateLocationHistory, 
      saveTemplate, 
      deleteTemplate, 
      restoreSystemTemplate,
      deleteHistoryRecord, 
      viewHistory,
      saveImage, 
      loadImage,
      getSystemExportData,
      importSystemSettings, 
      importSession,
      importHistoryRecord, 
  };
};
