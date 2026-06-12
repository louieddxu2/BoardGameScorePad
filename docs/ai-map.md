# AI Map (Token-Saving Edition)

This file is the single source of truth for AI navigation.
Run `npm run docs:ai-map` after implementation work to update AUTO sections in-place.

## One-Line Product Positioning
BoardGameScorePad is an offline-first board-game scoring, history, stats, and sharing tool.

## How To Use This Map
1. Identify the task module first.
2. Read only relevant files.
3. Avoid cross-layer edits unless required by evidence.

## Fixed External Planning Sources
- Google Doc `BoardGameScorePad維護紀錄`: `https://docs.google.com/document/d/1qBNkRjSoGYXHFTk-f3E3dzSle5_1TAITNnHy7CkbALQ`. Use this fixed doc for ongoing maintenance notes and history-stats-panel proposals instead of re-searching Drive each time.

## UI Layout Patterns
- `StartGamePanel` is the reference layout for bottom-docked dashboard panels: left scrollable content, right chimney controls, and a fixed bottom action row.
- `HistoryStatsPanel` intentionally mirrors the StartGamePanel layout language; inspect the game selector panel before changing its dock height, chimney behavior, or bottom actions.
- History stats keeps the right-side chimney actions in their collapsed positions when expanded; expansion adds working space without relocating the existing controls.
- `HistoryPhotoGridShareModal` is a modal child of the stats panel, not a replacement for it. It should use modal/back-handler behavior like other dashboard modals and should block panel swipe navigation while open.
- The photo-grid recap currently exports 8 photo tiles with stats at the top, not a 9-tile-only layout. Keep this vertical-share layout in mind before changing tile count or export proportions.
- The photo-grid crop editor uses a two-zone flow: large crop surface above, horizontal photo thumbnails below. Image zoom/pan is implemented with uniform transform scaling so aspect ratio stays intact and the image may overflow the crop frame.
- Photo-grid crop gestures must be a local exception to `useMobileZoom()`: pinch should update only the image crop zoom and must not change the app-wide font-size zoom.

## Data Aggregation Patterns
- Game search uses `useGameOptionAggregator` to merge `savedGames`, `templates`, and `bggGames` into unique `GameOption` objects before filtering or rendering.
- The game selector merge order is base saved game, overlay template, then BGG dictionary enrichment; matching prefers `bggId`, then normalized name or BGG aliases.
- Keep search/sort/filter logic downstream of aggregation. UI components should consume merged options instead of resolving template/game/BGG compatibility themselves.
- History stats and photo grid should consume derived `HistoryGameEntry` objects from active, unsearched history summaries; dashboard search filters the visible history list, not the global stats aggregate.
- History stats aggregation is not the same as game search aggregation: search builds playable `GameOption` candidates from current game/template/BGG sources, while history stats summarizes already-played records and deduplicates by historical game identity before applying stats filters.
- History stats date/rule/location filters affect the stats aggregate and photo-grid source, not the left-side raw history list until a full history filtering architecture is implemented.
- History player stats use `savedPlayers` as the canonical player universe. History records are snapshots of appearances, but distinct player counts should resolve linked IDs or names back to the saved player master list and ignore orphan/stale identities that are not in that list.
- The hidden/debug data inspector's player count is a raw `db.savedPlayers` table count. Treat that as the master-list count, not as a count of every player identity ever seen in history snapshots.
- `buildHistoryGameEntries()` is the canonical history-game aggregation boundary. History stats, ranking rows, and photo-grid source selection should consume `HistoryGameEntry` instead of reimplementing record deduplication in UI components.
- History game ranking renders only the first `DATA_LIMITS.QUERY.HISTORY_STATS_GAMES` entries, while aggregate counts still use all filtered entries.
- Photo-grid item selection uses one entry per deduplicated game and defaults to the latest record's first photo. Replacement candidates for the same game are ordered by newer record first, then by in-record photo order, and are capped by `DATA_LIMITS.QUERY.HISTORY_PHOTO_GRID_CANDIDATES`.
- Photo-grid opening should load only the selected recap photos. Same-game replacement candidates should load lazily when the crop editor opens, and should not walk every photo from a game with a large album.

## Release Observation Notes
- Before release, history stats should be checked for stability with large history sets, but the current pragmatic cap is list display count rather than full virtualization.
- Photo recap readability remains a design question: 8 vertical-share tiles may still make individual board photos small, especially for table-wide horizontal photos.
- Do not expand date/rule/location/player filters into a full left-list filtering architecture unless the task explicitly asks for that larger behavior.

## Player Selector Tool Patterns
- The selector runs a custom physics engine in `usePlayerSelectorRenderer.ts` decoupled from React rendering cycles. It uses `candidatesRef` and `callbacksRef` to handle canvas/SVG interactions without triggering component re-renders.
- Radial anchor-points are calculated relative to a central dashed ellipse (`rx = width * 0.32`, `ry = height * 0.21`). User seat orientations are normalized against physical viewport aspect ratios to prevent vector distortion on flat tablets.
- Gesture mechanics implement a high-rigidity (k = 0.4) 200ms joystick calibration window immediately on pointer down to eliminate spring lag. This shifts into lock-on/palette-drawing stages on drag, or triggers a local 500ms refresh (Tap-to-Refresh) if tapped.
- Color recommendation is deferred (Lazy load) until a candidate is locked. Recommended colors exclude already locked colors and display a dual outermost ripple effect for strong feedback.
- To support clone players (same saved player on multiple seats), confirmed participants are saved using unique seat IDs (`sp.id`) in the session, with deduplication logic (`usedExistingIds`) preventing multiple seats from grabbing/mutating the same existing session player record.

## Module Index (Auto-Maintained)

### Dashboard / Stats / Photo Grid
<!-- AUTO:dashboard:start -->
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/HistoryList.tsx`
- `src/components/dashboard/HistoryPhotoGridShareModal.tsx`
- `src/components/dashboard/HistoryStatsPanel.tsx`
- `src/components/dashboard/hooks/useDashboardActions.test.ts`
- `src/components/dashboard/hooks/useDashboardActions.ts`
- `src/components/dashboard/hooks/useDashboardData.ts`
- `src/components/dashboard/hooks/useDashboardModals.ts`
- `src/components/dashboard/hooks/useDebugGestures.ts`
- `src/components/dashboard/modals/CloudLibraryModal.tsx`
- `src/components/dashboard/modals/CloudManagerModal.tsx`
- `src/components/dashboard/modals/DataManagerModal.tsx`
- `src/components/dashboard/modals/GameSetupModal.tsx`
- `src/components/dashboard/modals/SearchTemplateOnlineModal.tsx`
- `src/components/dashboard/modals/ShareTemplateModal.tsx`
- `src/components/dashboard/modals/SyncDashboard.tsx`
- `src/components/dashboard/parts/DashboardFAB.tsx`
- `src/components/dashboard/parts/DashboardHeader.tsx`
- `src/components/dashboard/parts/DashboardModals.tsx`
- `src/components/dashboard/parts/DashboardSection.tsx`
- `src/components/dashboard/parts/GameCard.tsx`
- `src/components/dashboard/parts/HistoryCard.tsx`
- `src/components/dashboard/parts/PullActionIsland.tsx`
- `src/components/dashboard/parts/SearchEmptyState.tsx`
- `src/components/dashboard/views/HistoryView.tsx`
- `src/components/dashboard/views/LibraryView.tsx`
- `src/utils/historyGameEntries.test.ts`
- `src/utils/historyGameEntries.ts`
- `src/utils/historyStats.test.ts`
- `src/utils/historyStats.ts`
<!-- AUTO:dashboard:end -->

### Game Selector / Start Panel
<!-- AUTO:game-selector:start -->
- `src/features/game-selector/components/AdvancedFilterChimney.tsx`
- `src/features/game-selector/components/GameLaunchActions.tsx`
- `src/features/game-selector/components/GameLaunchDashboard.tsx`
- `src/features/game-selector/components/GameListView.tsx`
- `src/features/game-selector/components/GameOptionItem.tsx`
- `src/features/game-selector/components/StartGameOverlays.tsx`
- `src/features/game-selector/components/StartGamePanel.tsx`
- `src/features/game-selector/hooks/useCloudTemplateSuggestion.ts`
- `src/features/game-selector/hooks/useGameLauncher.ts`
- `src/features/game-selector/hooks/useGameOptionAggregator.ts`
- `src/features/game-selector/hooks/useGameSelectorLogic.ts`
- `src/features/game-selector/hooks/useRecommendedGameSetup.ts`
- `src/features/game-selector/hooks/useStartGamePanelController.ts`
- `src/features/game-selector/types.ts`
- `src/features/game-selector/utils/sortStrategies.ts`
<!-- AUTO:game-selector:end -->

### Session
<!-- AUTO:session:start -->
- `src/components/session/hooks/useColumnDragAndDrop.ts`
- `src/components/session/hooks/useSessionEvents.ts`
- `src/components/session/hooks/useSessionMedia.ts`
- `src/components/session/hooks/useSessionNavigation.ts`
- `src/components/session/hooks/useSessionState.ts`
- `src/components/session/hooks/useVoiceAnnouncements.ts`
- `src/components/session/modals/AddColumnModal.tsx`
- `src/components/session/modals/PhotoGalleryModal.tsx`
- `src/components/session/modals/ScreenshotModal.tsx`
- `src/components/session/modals/SessionBackgroundModal.tsx`
- `src/components/session/modals/SessionExitModal.tsx`
- `src/components/session/modals/ShareMenu.tsx`
- `src/components/session/parts/AutoScorePanel.tsx`
- `src/components/session/parts/GridFooter.tsx`
- `src/components/session/parts/InputPanel.tsx`
- `src/components/session/parts/InputPanelLayout.tsx`
- `src/components/session/parts/PhotoLightbox.tsx`
- `src/components/session/parts/PlayerEditor.tsx`
- `src/components/session/parts/ScoreCell.tsx`
- `src/components/session/parts/ScoreGrid.tsx`
- `src/components/session/parts/ScoreInfoPanel.tsx`
- `src/components/session/parts/ScoreOverlayGenerator.tsx`
- `src/components/session/parts/ScreenshotView.tsx`
- `src/components/session/parts/SelectOptionInput.tsx`
- `src/components/session/parts/SessionHeader.tsx`
- `src/components/session/parts/SimpleScorepadPromo.tsx`
- `src/components/session/parts/SmartSpacer.tsx`
- `src/components/session/parts/SmartTextureLayer.tsx`
- `src/components/session/parts/StickerElement.tsx`
- `src/components/session/parts/TexturedBlock.tsx`
- `src/components/session/parts/TexturedPlayerHeader.tsx`
- `src/components/session/parts/TexturedScoreCell.tsx`
- `src/components/session/parts/TexturedScreenshotView.tsx`
- `src/components/session/parts/TexturedTotalCell.tsx`
- `src/components/session/parts/TotalsBar.tsx`
- `src/components/session/SessionImageFlow.tsx`
- `src/components/session/SessionUI.test.tsx`
- `src/components/session/SessionView.toolboxScroll.test.tsx`
- `src/components/session/SessionView.tsx`
<!-- AUTO:session:end -->

### Player Selector
<!-- AUTO:player-selector:start -->
- `src/components/tools/player-selector/PlayerSelectorModal.test.tsx`
- `src/components/tools/player-selector/PlayerSelectorModal.tsx`
- `src/components/tools/player-selector/selectorCandidates.test.ts`
- `src/components/tools/player-selector/selectorCandidates.ts`
- `src/components/tools/player-selector/selectorDisplay.test.ts`
- `src/components/tools/player-selector/selectorDisplay.ts`
- `src/components/tools/player-selector/selectorEngineTypes.ts`
- `src/components/tools/player-selector/selectorHitTest.test.ts`
- `src/components/tools/player-selector/selectorHitTest.ts`
- `src/components/tools/player-selector/selectorPainter.ts`
- `src/components/tools/player-selector/selectorSvg.ts`
- `src/components/tools/player-selector/turnOrder.test.ts`
- `src/components/tools/player-selector/turnOrder.ts`
- `src/components/tools/player-selector/types.ts`
- `src/components/tools/player-selector/usePlayerSelectorRenderer.test.tsx`
- `src/components/tools/player-selector/usePlayerSelectorRenderer.ts`
<!-- AUTO:player-selector:end -->

### Template
<!-- AUTO:template:start -->
- (no entries yet)
<!-- AUTO:template:end -->

### History
<!-- AUTO:history:start -->
- `src/components/history/HistoryReviewView.tsx`
- `src/components/history/modals/HistorySettingsModal.tsx`
- `src/hooks/queries/useHistoryQuery.ts`
<!-- AUTO:history:end -->

### AI Generator
<!-- AUTO:ai-generator:start -->
- `src/features/ai-generator/aiModelNames.test.ts`
- `src/features/ai-generator/components/AiPromptModal.tsx`
- `src/features/ai-generator/components/AiSimplePromptModal.tsx`
- `src/features/ai-generator/hooks/useAiGenerator.ts`
- `src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`
- `src/features/ai-generator/hooks/useAiSimpleGenerator.ts`
- `src/features/ai-generator/services/aiApiService.test.ts`
- `src/features/ai-generator/services/aiApiService.ts`
- `src/features/ai-generator/services/aiExpander.test.ts`
- `src/features/ai-generator/services/aiExpander.ts`
- `src/features/ai-generator/services/aiUsageLimit.test.ts`
- `src/features/ai-generator/services/aiUsageLimit.ts`
- `src/features/ai-generator/utils/imageProcessor.ts`
<!-- AUTO:ai-generator:end -->

### i18n
<!-- AUTO:i18n:start -->
- `src/i18n/aiGenerator.ts`
- `src/i18n/app.ts`
- `src/i18n/cloud_library.ts`
- `src/i18n/cloud.ts`
- `src/i18n/column_editor.ts`
- `src/i18n/common.ts`
- `src/i18n/dashboard.ts`
- `src/i18n/data_manager.ts`
- `src/i18n/game_flow.ts`
- `src/i18n/gameSettings.ts`
- `src/i18n/history_stats.ts`
- `src/i18n/history.ts`
- `src/i18n/hooks.test.tsx`
- `src/i18n/i18n.test.ts`
- `src/i18n/index.tsx`
- `src/i18n/inspector.ts`
- `src/i18n/integration.test.tsx`
- `src/i18n/integration.ts`
- `src/i18n/scanner.ts`
- `src/i18n/search_template_online.ts`
- `src/i18n/session.test.tsx`
- `src/i18n/session.ts`
- `src/i18n/setup.ts`
- `src/i18n/template_editor.ts`
- `src/i18n/tools.test.tsx`
- `src/i18n/tools.ts`
<!-- AUTO:i18n:end -->

### Shared Hooks / Utils / Types
<!-- AUTO:shared:start -->
- `src/components/analysis/inspector/hooks/useImageSource.ts`
- `src/components/analysis/inspector/hooks/useMaintenance.ts`
- `src/components/dashboard/hooks/useDashboardActions.test.ts`
- `src/components/dashboard/hooks/useDashboardActions.ts`
- `src/components/dashboard/hooks/useDashboardData.ts`
- `src/components/dashboard/hooks/useDashboardModals.ts`
- `src/components/dashboard/hooks/useDebugGestures.ts`
- `src/components/editor/hooks/useTextureMapperInteractions.ts`
- `src/components/editor/utils/templateBuilder.ts`
- `src/components/scanner/hooks/useScannerInteractions.ts`
- `src/components/session/hooks/useColumnDragAndDrop.ts`
- `src/components/session/hooks/useSessionEvents.ts`
- `src/components/session/hooks/useSessionMedia.ts`
- `src/components/session/hooks/useSessionNavigation.ts`
- `src/components/session/hooks/useSessionState.ts`
- `src/components/session/hooks/useVoiceAnnouncements.ts`
- `src/features/ai-generator/hooks/useAiGenerator.ts`
- `src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`
- `src/features/ai-generator/hooks/useAiSimpleGenerator.ts`
- `src/features/ai-generator/utils/imageProcessor.ts`
- `src/features/bgstats/hooks/useImportLinking.ts`
- `src/features/game-selector/hooks/useCloudTemplateSuggestion.ts`
- `src/features/game-selector/hooks/useGameLauncher.ts`
- `src/features/game-selector/hooks/useGameOptionAggregator.ts`
- `src/features/game-selector/hooks/useGameSelectorLogic.ts`
- `src/features/game-selector/hooks/useRecommendedGameSetup.ts`
- `src/features/game-selector/hooks/useStartGamePanelController.ts`
- `src/features/game-selector/utils/sortStrategies.ts`
<!-- AUTO:shared:end -->

### Other Source Files
<!-- AUTO:other:start -->
- `src/App.deeplink.test.tsx`
- `src/App.tsx`
- `src/colors.ts`
- `src/components/analysis/inspector/InspectorContainer.tsx`
- `src/components/analysis/inspector/inspectors/DatabaseInspector.tsx`
- `src/components/analysis/inspector/inspectors/ImageInspector.tsx`
- `src/components/analysis/inspector/inspectors/TimeInspector.tsx`
- `src/components/analysis/inspector/inspectors/WeightsInspector.tsx`
- `src/components/analysis/inspector/shared/InspectorCommon.tsx`
- `src/components/analysis/InspectorShared.tsx`
- `src/components/analysis/MetaFriendlyView.tsx`
- `src/components/analysis/SystemDataInspector.tsx`
- `src/components/editor/GridPhase.tsx`
- `src/components/editor/ImportTemplateModal.tsx`
- `src/components/editor/MappingDrawer.tsx`
- `src/components/editor/StructurePhase.tsx`
- `src/components/editor/TemplateEditor.tsx`
- `src/components/editor/TextureMapper.tsx`
- `src/components/editor/TextureMapperContext.tsx`
- `src/components/modals/InAppBrowserGuide.tsx`
- `src/components/modals/InstallGuideModal.tsx`
- `src/components/modals/IOSPwaGuide.test.tsx`
- `src/components/modals/IOSPwaGuide.tsx`
- `src/components/scanner/CameraView.tsx`
- `src/components/scanner/Magnifier.tsx`
- `src/components/scanner/PhotoScanner.tsx`
- `src/components/scanner/ScannerControls.tsx`
- `src/components/scanner/ScannerOverlay.tsx`
- `src/components/scanner/ScannerSourceSelector.tsx`
- `src/components/scanner/ScanPreview.tsx`
- `src/components/shared/column-editor/EditorTabAuto.tsx`
- `src/components/shared/column-editor/EditorTabBasic.tsx`
- `src/components/shared/column-editor/EditorTabMapping.tsx`
- `src/components/shared/column-editor/EditorTabSelection.tsx`
- `src/components/shared/column-editor/QuickActionsEditor.tsx`
- `src/components/shared/ColumnConfigEditor.tsx`
- `src/components/shared/ConfirmationModal.tsx`
- `src/components/shared/ContrastText.tsx`
- `src/components/shared/ErrorBoundary.tsx`
- `src/components/shared/GameSettingsEditor.tsx`
<!-- AUTO:other:end -->

## Common Validation Commands
- `npx tsc --noEmit`
- `npx vitest run --exclude "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"`
- `powershell -ExecutionPolicy Bypass -File scripts\scan-hardcoded-chinese.ps1` (required for UI, i18n, visible text, modal, button-label, and dashboard panel changes)
- `npx vitest run src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx` (AI simple generator tasks)

## Token-Saving Rules
1. Start with targeted files only.
2. For UI tasks, inspect component-level layout before global styles.
3. Report modified files and verification results in every task.
